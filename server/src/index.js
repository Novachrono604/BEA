import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from './db.js';

const app = express();
const PORT = process.env.PORT || 4000;
const SECRET = process.env.JWT_SECRET || 'dev-only-change-me';
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));
const publicUser = u => ({ id:u.id, name:u.name, email:u.email, college:u.college || '' });
function auth(req,res,next) {
 const token = (req.headers.authorization || '').replace(/^Bearer\s+/i,'');
 if (!token) return res.status(401).json({error:'Please sign in first.'});
 try { req.user = jwt.verify(token, SECRET); next(); } catch { return res.status(401).json({error:'Session expired. Please sign in again.'}); }
}
const listingSelect = `SELECT l.*, u.name AS seller_name, u.college AS seller_college
 FROM listings l JOIN users u ON u.id=l.user_id`;
app.get('/api/health', (req,res)=>res.json({ok:true, service:'CampusBooks API'}));
app.post('/api/auth/register', (req,res)=>{
 const {name,email,password,college=''}=req.body || {};
 if (!name?.trim() || !email?.trim() || !password || password.length<8) return res.status(400).json({error:'Name, email and a password of at least 8 characters are required.'});
 try {
  const info=db.prepare('INSERT INTO users(name,email,password_hash,college) VALUES(?,?,?,?)').run(name.trim(),email.trim().toLowerCase(),bcrypt.hashSync(password,10),college.trim());
  const user=db.prepare('SELECT * FROM users WHERE id=?').get(info.lastInsertRowid);
  const token=jwt.sign({id:user.id,email:user.email},SECRET,{expiresIn:'7d'});
  res.status(201).json({token,user:publicUser(user)});
 } catch(e) { res.status(409).json({error:'An account with this email already exists.'}); }
});
app.post('/api/auth/login',(req,res)=>{
 const {email,password}=req.body || {};
 const user=db.prepare('SELECT * FROM users WHERE email=?').get((email||'').trim().toLowerCase());
 if(!user || !bcrypt.compareSync(password||'',user.password_hash)) return res.status(401).json({error:'Invalid email or password.'});
 res.json({token:jwt.sign({id:user.id,email:user.email},SECRET,{expiresIn:'7d'}),user:publicUser(user)});
});
app.get('/api/auth/me',auth,(req,res)=>{
 const u=db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
 if(!u) return res.status(401).json({error:'Account not found.'});
 res.json({user:publicUser(u)});
});
app.get('/api/listings',(req,res)=>{
 const {q='',branch='',semester='',subject='',condition='',maxPrice=''}=req.query;
 let sql=listingSelect+` WHERE l.status='available'`; const args=[];
 if(q.trim()){sql+=` AND (l.title LIKE ? OR l.author LIKE ? OR l.subject LIKE ? OR l.description LIKE ?)`; const v=`%${q.trim()}%`;args.push(v,v,v,v);}
 if(branch){sql+=' AND l.branch=?';args.push(branch);}
 if(semester){sql+=' AND l.semester=?';args.push(Number(semester));}
 if(subject){sql+=' AND l.subject LIKE ?';args.push(`%${subject}%`);}
 if(condition){sql+=' AND l.condition=?';args.push(condition);}
 if(maxPrice!=='' && Number.isFinite(Number(maxPrice))){sql+=' AND l.price<=?';args.push(Number(maxPrice));}
 sql+=' ORDER BY l.created_at DESC';
 res.json({listings:db.prepare(sql).all(...args)});
});
app.get('/api/listings/mine',auth,(req,res)=>res.json({listings:db.prepare(listingSelect+' WHERE l.user_id=? ORDER BY l.created_at DESC').all(req.user.id)}));
app.get('/api/listings/:id',(req,res)=>{
 const listing=db.prepare(listingSelect+' WHERE l.id=?').get(Number(req.params.id));
 if(!listing) return res.status(404).json({error:'Listing not found.'});
 res.json({listing});
});
app.post('/api/listings',auth,(req,res)=>{
 const {title,author='',subject,branch,semester,price,condition,description='',image_url=''}=req.body||{};
 if(!title?.trim()||!subject?.trim()||!branch?.trim()||!semester||price===undefined||!condition) return res.status(400).json({error:'Please complete title, subject, branch, semester, price and condition.'});
 if(!Number.isFinite(Number(price))||Number(price)<0||!Number.isInteger(Number(semester))||Number(semester)<1||Number(semester)>8) return res.status(400).json({error:'Enter a valid price and semester (1–8).'});
 const info=db.prepare(`INSERT INTO listings(user_id,title,author,subject,branch,semester,price,condition,description,image_url)
 VALUES(?,?,?,?,?,?,?,?,?,?)`).run(req.user.id,title.trim(),author.trim(),subject.trim(),branch.trim().toUpperCase(),Number(semester),Number(price),condition,description.trim(),image_url.trim());
 res.status(201).json({listing:db.prepare(listingSelect+' WHERE l.id=?').get(info.lastInsertRowid)});
});
app.put('/api/listings/:id',auth,(req,res)=>{
 const id=Number(req.params.id), old=db.prepare('SELECT * FROM listings WHERE id=?').get(id);
 if(!old) return res.status(404).json({error:'Listing not found.'});
 if(old.user_id!==req.user.id) return res.status(403).json({error:'You can only edit your own listing.'});
 const b=req.body||{}; const vals=['title','author','subject','branch','semester','price','condition','description','image_url'].map(k=>b[k]??old[k]);
 db.prepare(`UPDATE listings SET title=?,author=?,subject=?,branch=?,semester=?,price=?,condition=?,description=?,image_url=? WHERE id=?`).run(...vals,id);
 res.json({listing:db.prepare(listingSelect+' WHERE l.id=?').get(id)});
});
app.delete('/api/listings/:id',auth,(req,res)=>{
 const old=db.prepare('SELECT * FROM listings WHERE id=?').get(Number(req.params.id));
 if(!old) return res.status(404).json({error:'Listing not found.'});
 if(old.user_id!==req.user.id) return res.status(403).json({error:'You can only delete your own listing.'});
 db.prepare('DELETE FROM messages WHERE listing_id=?').run(old.id);
 db.prepare('DELETE FROM requests WHERE listing_id=?').run(old.id);
 db.prepare('DELETE FROM listings WHERE id=?').run(old.id);
 res.json({ok:true});
});
app.post('/api/requests',auth,(req,res)=>{
 const {listing_id,message=''}=req.body||{};
 const l=db.prepare('SELECT * FROM listings WHERE id=? AND status=?').get(Number(listing_id),'available');
 if(!l) return res.status(404).json({error:'This book is no longer available.'});
 if(l.user_id===req.user.id) return res.status(400).json({error:'You cannot request your own listing.'});
 try {
  const info=db.prepare('INSERT INTO requests(listing_id,buyer_id,message) VALUES(?,?,?)').run(l.id,req.user.id,message.trim());
  res.status(201).json({request:db.prepare(`SELECT r.*,l.title,u.name AS buyer_name FROM requests r JOIN listings l ON l.id=r.listing_id JOIN users u ON u.id=r.buyer_id WHERE r.id=?`).get(info.lastInsertRowid)});
 } catch { res.status(409).json({error:'You have already requested this book.'}); }
});
app.get('/api/requests',auth,(req,res)=>{
 const incoming=db.prepare(`SELECT r.*,l.title,l.price,l.user_id AS seller_id,b.name AS buyer_name,b.email AS buyer_email
 FROM requests r JOIN listings l ON l.id=r.listing_id JOIN users b ON b.id=r.buyer_id WHERE l.user_id=? ORDER BY r.created_at DESC`).all(req.user.id);
 const outgoing=db.prepare(`SELECT r.*,l.title,l.price,l.user_id AS seller_id,s.name AS seller_name
 FROM requests r JOIN listings l ON l.id=r.listing_id JOIN users s ON s.id=l.user_id WHERE r.buyer_id=? ORDER BY r.created_at DESC`).all(req.user.id);
 res.json({incoming,outgoing});
});
app.patch('/api/requests/:id',(req,res)=>{
 // Authentication is applied below via explicit middleware route.
 res.status(405).json({error:'Use authenticated request status endpoint.'});
});
app.patch('/api/requests/:id/status',auth,(req,res)=>{
 const r=db.prepare(`SELECT r.*,l.user_id AS seller_id,l.id AS lid FROM requests r JOIN listings l ON l.id=r.listing_id WHERE r.id=?`).get(Number(req.params.id));
 if(!r) return res.status(404).json({error:'Request not found.'});
 if(r.seller_id!==req.user.id) return res.status(403).json({error:'Only the seller can update this request.'});
 const status=req.body?.status;
 if(!['accepted','rejected','completed'].includes(status)) return res.status(400).json({error:'Invalid status.'});
 db.prepare('UPDATE requests SET status=? WHERE id=?').run(status,r.id);
 if(status==='accepted') db.prepare("UPDATE listings SET status='reserved' WHERE id=?").run(r.lid);
 if(status==='rejected') db.prepare("UPDATE listings SET status='available' WHERE id=? AND status='reserved'").run(r.lid);
 res.json({ok:true});
});
app.get('/api/messages/:listingId',auth,(req,res)=>{
 const l=db.prepare('SELECT * FROM listings WHERE id=?').get(Number(req.params.listingId));
 if(!l) return res.status(404).json({error:'Listing not found.'});
 if(l.user_id!==req.user.id && !db.prepare('SELECT 1 FROM requests WHERE listing_id=? AND buyer_id=?').get(l.id,req.user.id)) return res.status(403).json({error:'Request this book before messaging the seller.'});
 const messages=db.prepare(`SELECT m.*,u.name AS sender_name FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.listing_id=? AND (m.sender_id=? OR m.receiver_id=?) ORDER BY m.created_at ASC`).all(l.id,req.user.id,req.user.id);
 res.json({messages});
});
app.post('/api/messages/:listingId',auth,(req,res)=>{
 const l=db.prepare('SELECT * FROM listings WHERE id=?').get(Number(req.params.listingId));
 if(!l) return res.status(404).json({error:'Listing not found.'});
 if(l.user_id!==req.user.id && !db.prepare('SELECT 1 FROM requests WHERE listing_id=? AND buyer_id=?').get(l.id,req.user.id)) return res.status(403).json({error:'Request this book before messaging the seller.'});
 const body=(req.body?.body||'').trim();
 if(!body || body.length>2000) return res.status(400).json({error:'Message must be between 1 and 2000 characters.'});
 const receiver=l.user_id===req.user.id ? db.prepare('SELECT buyer_id FROM requests WHERE listing_id=? ORDER BY created_at DESC LIMIT 1').get(l.id)?.buyer_id : l.user_id;
 if(!receiver) return res.status(400).json({error:'No buyer has requested this book yet.'});
 const info=db.prepare('INSERT INTO messages(listing_id,sender_id,receiver_id,body) VALUES(?,?,?,?)').run(l.id,req.user.id,receiver,body);
 res.status(201).json({message:db.prepare('SELECT m.*,u.name AS sender_name FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.id=?').get(info.lastInsertRowid)});
});
app.use((err,req,res,next)=>{ console.error(err); res.status(500).json({error:'Unexpected server error.'}); });
app.listen(PORT,()=>console.log(`CampusBooks API listening on http://localhost:${PORT}`));
