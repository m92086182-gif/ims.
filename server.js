
const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const session = require('express-session');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const DB = path.join(__dirname, 'db.json');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({ secret: 'ims_final_v4_secret', resave: false, saveUninitialized: true }));

function readDB(){ if(!fs.existsSync(DB)) return {countries:[],orders:[]}; return JSON.parse(fs.readFileSync(DB)); }
function writeDB(d){ fs.writeFileSync(DB, JSON.stringify(d,null,2),'utf-8'); }

app.get('/', (req,res)=> res.sendFile(path.join(__dirname,'public','index.html')));
app.get('/login', (req,res)=> res.sendFile(path.join(__dirname,'public','login.html')));
app.get('/admin', (req,res)=>{
  if(!req.session.user || req.session.user.role!=='admin') return res.redirect('/login');
  res.sendFile(path.join(__dirname,'public','admin.html'));
});

// APIs
app.get('/api/countries',(req,res)=>{ const db=readDB(); res.json(db.countries); });

app.post('/api/countries',(req,res)=>{
  if(!req.session.user || req.session.user.role!=='admin') return res.status(403).json({error:'forbidden'});
  const {name,code} = req.body;
  const db = readDB();
  const id = db.countries.length ? Math.max(...db.countries.map(c=>c.id))+1 : 1;
  db.countries.push({id,name,code,ranges:[]});
  writeDB(db);
  io.emit('countriesUpdated', db.countries);
  res.json({ok:true});
});

app.post('/api/countries/:id/ranges',(req,res)=>{
  if(!req.session.user || req.session.user.role!=='admin') return res.status(403).json({error:'forbidden'});
  const id = Number(req.params.id);
  const {range} = req.body;
  const db = readDB();
  const country = db.countries.find(c=>c.id===id);
  if(!country) return res.status(404).json({error:'not found'});
  country.ranges.push(range);
  writeDB(db);
  io.emit('countriesUpdated', db.countries);
  res.json({ok:true});
});

app.delete('/api/countries/:id/ranges',(req,res)=>{
  if(!req.session.user || req.session.user.role!=='admin') return res.status(403).json({error:'forbidden'});
  const id = Number(req.params.id);
  const {range} = req.body;
  const db = readDB();
  const country = db.countries.find(c=>c.id===id);
  if(!country) return res.status(404).json({error:'not found'});
  country.ranges = country.ranges.filter(r=>r!==range);
  writeDB(db);
  io.emit('countriesUpdated', db.countries);
  res.json({ok:true});
});

app.post('/api/request-number',(req,res)=>{
  const {countryId,count,username,range} = req.body;
  const db = readDB();
  const order = { id: db.orders.length+1, type:'number', countryId:Number(countryId), count:Number(count), username:username||null, range: range||null, status:'pending', createdAt:new Date().toISOString() };
  db.orders.push(order);
  writeDB(db);
  io.emit('newOrder', order);
  res.json({message:'قيد التنفيذ', orderId:order.id});
});

app.post('/api/request-user',(req,res)=>{
  const {fullname,whatsapp} = req.body;
  const db = readDB();
  const order = { id: db.orders.length+1, type:'user', fullname, whatsapp, status:'pending', createdAt:new Date().toISOString() };
  db.orders.push(order);
  writeDB(db);
  io.emit('newOrder', order);
  res.json({message:'قيد التنفيذ', orderId:order.id});
});

app.get('/api/orders',(req,res)=>{
  if(!req.session.user || req.session.user.role!=='admin') return res.status(403).json({error:'forbidden'});
  const db = readDB();
  res.json(db.orders);
});

app.post('/api/orders/:id/execute',(req,res)=>{
  if(!req.session.user || req.session.user.role!=='admin') return res.status(403).json({error:'forbidden'});
  const id = Number(req.params.id);
  const db = readDB();
  const order = db.orders.find(o=>o.id===id);
  if(!order) return res.status(404).json({error:'not found'});
  order.status='done';
  order.executedAt = new Date().toISOString();
  writeDB(db);
  io.emit('orderExecuted', order);
  res.json({ok:true});
});

// admin login
const ADMIN_USER = 'Mohamed77ngq';
const ADMIN_PASS = 'Mohamed77ngq';
app.post('/api/admin/login',(req,res)=>{
  const {username,password} = req.body;
  if(username===ADMIN_USER && password===ADMIN_PASS){
    req.session.user = {username, role:'admin'};
    return res.json({ok:true});
  }
  res.status(401).json({error:'invalid'});
});

app.post('/api/admin/logout',(req,res)=>{ req.session.destroy(()=>res.json({ok:true})); });

io.on('connection', socket => {
  const db = readDB();
  socket.emit('init', {countries: db.countries, orders: db.orders});
});

server.listen(PORT, ()=> console.log(`Server listening on http://localhost:${PORT}`));
