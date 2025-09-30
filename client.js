const socket = io();

// Smooth scroll for nav links
document.querySelectorAll('a[href^="#"]').forEach(a=>{
  a.addEventListener('click', function(e){
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if(target) target.scrollIntoView({behavior:'smooth', block:'start'});
  });
});

// Reveal sections with IntersectionObserver
const observer = new IntersectionObserver((entries)=>{
  entries.forEach(entry=>{
    if(entry.isIntersecting){
      entry.target.classList.add('visible');
    }
  });
},{threshold:0.15});

document.querySelectorAll('.section-animated').forEach(s=>observer.observe(s));

// load countries and render cards with ranges
async function loadCountries(){ 
  const res = await fetch('/api/countries'); 
  const list = await res.json(); 
  const grid = document.getElementById('countriesGrid'); 
  grid.innerHTML = list.map(c=>`
    <div class="country-card">
      <img src="https://via.placeholder.com/640x360?text=${encodeURIComponent(c.name)}" alt="${c.name}" class="img-fluid"/>
      <h5 class="mt-2">${c.name}</h5>
      <p class="text-muted small">${c.code}</p>
      <div class="mb-2">
        <label>رينج (إن وجد)</label>
        <select class="form-select range-select" data-country="${c.id}">
          <option value="">بدون رينج</option>
          ${ (c.ranges||[]).map(r=>`<option value="${r}">${r}</option>`).join('') }
        </select>
      </div>
      <div class="mb-2">
        <label>العدد</label>
        <input type="number" class="form-control count-input" data-country="${c.id}" value="1" min="1"/>
      </div>
      <button class="btn btn-success w-100 order-btn" data-country="${c.id}">طلب</button>
    </div>
  `).join(''); 
  document.querySelectorAll('.order-btn').forEach(btn=>btn.addEventListener('click', async (e)=>{ 
    const cid = btn.dataset.country; 
    const range = document.querySelector('.range-select[data-country="'+cid+'"]').value; 
    const count = document.querySelector('.count-input[data-country="'+cid+'"]').value; 
    const res = await fetch('/api/request-number',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({countryId:cid,count,username:'',range})}); 
    const j = await res.json(); alert(j.message || j.error || 'تم الطلب'); 
  })); 
}
loadCountries();

// user form submit
document.getElementById('userForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const fullname = document.getElementById('u_name').value;
  const whatsapp = document.getElementById('u_whatsapp').value;
  const res = await fetch('/api/request-user',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({fullname,whatsapp})});
  const j = await res.json();
  document.getElementById('userResult').textContent = j.message || j.error || 'تم الطلب';
});

// socket notifications
socket.on('newOrder', order=>{
  if(Notification && Notification.permission==='granted') new Notification('طلب جديد', { body: `#${order.id} - ${order.type}` });
  else if(Notification && Notification.permission!=='denied') Notification.requestPermission();
});
socket.on('orderExecuted', order=>{
  if(Notification && Notification.permission==='granted') new Notification('تم تنفيذ طلب', { body: `الطلب #${order.id} تم تنفيذه` });
});
