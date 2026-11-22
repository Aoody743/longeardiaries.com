// The published Sites edition is a front-end demonstration. Its records stay
// in this browser's IndexedDB; this module does not authenticate real users.
const STORE='longear-sites-demo-v1';
const SESSION='longear-sites-demo-member';
const collections=['species','stories','events','partners','team','members'];
let databasePromise;
const copy=value=>structuredClone(value);
const stamp=()=>new Date().toISOString();
const id=prefix=>`${prefix}-${crypto.randomUUID()}`;
const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');

function database(){
  if(!databasePromise)databasePromise=new Promise((resolve,reject)=>{
    const request=indexedDB.open(STORE,1);
    request.onupgradeneeded=()=>request.result.createObjectStore('records');
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(Error('Browser storage is unavailable. Allow site storage to explore this demo.'));
    request.onblocked=()=>reject(Error('Close other demo tabs and try again.'));
  });
  return databasePromise;
}
async function read(){
  const db=await database();
  return new Promise((resolve,reject)=>{const request=db.transaction('records').objectStore('records').get('workspace');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
}
async function write(value,expectedRevision){
  const db=await database();
  return new Promise((resolve,reject)=>{
    const transaction=db.transaction('records','readwrite'),store=transaction.objectStore('records');
    let conflict=false;
    const current=store.get('workspace');
    current.onsuccess=()=>{
      if(expectedRevision!==undefined&&current.result?.content.revision!==expectedRevision){conflict=true;transaction.abort();return;}
      store.put(value,'workspace');
    };
    transaction.oncomplete=()=>resolve();
    transaction.onabort=transaction.onerror=()=>reject(Error(conflict?'The collection changed in another tab. Reload the office before saving again.':'Your browser could not save the demo. Free some site storage and try again.'));
  });
}
async function fresh(){
  const response=await fetch('demo-content.json');
  if(!response.ok)throw Error('The demo collection could not be opened. Reload this page to try again.');
  const content=await response.json();
  return {content,messages:[]};
}
async function workspace(){let value=await read();if(!value){value=await fresh();await write(value);}return value;}
function adminView(content){const result=copy(content);result.members=result.members.map(({passwordHash,password,...member})=>member);return result;}
function publicView(content){
  const result=adminView(content),showDemo=result.settings.showDemo!==false;
  for(const key of ['species','stories','events','partners'])result[key]=result[key].filter(record=>record.published!==false&&!record.archived&&(showDemo||!record.example));
  result.team=result.team.filter(record=>record.public!==false&&!record.archived&&(showDemo||!record.example)).sort((a,b)=>(+a.order||0)-(+b.order||0));
  result.members=[];return result;
}
function signedIn(value){return value.content.members.find(member=>member.id===sessionStorage.getItem(SESSION)&&member.active!==false);}
function requireMember(value){const member=signedIn(value);if(!member)throw Error('Please sign in to the field office.');return member;}
function revise(content){content.revision=(content.revision||0)+1;content.updatedAt=stamp();}
function validate(content){
  for(const key of collections){
    if(!Array.isArray(content[key])||content[key].length>500)throw Error('Please check the '+key+' collection.');
    const ids=content[key].map(record=>record.id);if(ids.some(value=>!value)||new Set(ids).size!==ids.length)throw Error('Records need unique IDs.');
  }
  if(!content.settings||typeof content.settings!=='object')throw Error('Site settings are missing.');
  const slugs=new Set();
  for(const species of content.species){
    if(!/^[a-z0-9-]+$/.test(species.slug||'')||slugs.has(species.slug))throw Error('Species need unique lowercase URL slugs.');slugs.add(species.slug);
    if(!Number.isFinite(+species.latitude)||Math.abs(+species.latitude)>90||!Number.isFinite(+species.longitude)||Math.abs(+species.longitude)>180)throw Error('Map coordinates are out of range.');
    if(!Array.isArray(species.diary))throw Error('A species needs a diary list.');
  }
  if(!content.members.some(member=>member.active!==false&&member.role==='admin'))throw Error('Keep at least one active administrator.');
}

export async function demoApi(path,method='GET',payload){
  const value=await workspace(),revision=value.content.revision;
  if(path==='/api/content'&&method==='GET')return publicView(value.content);
  if(path==='/api/session')return {member:signedIn(value)?adminView({members:[signedIn(value)]}).members[0]:null};
  if(path==='/api/login'&&method==='POST'){
    const member=value.content.members.find(member=>member.active!==false&&member.email.toLowerCase()===String(payload.email||'').trim().toLowerCase());
    if(!member||!String(payload.password||''))throw Error('That email and password do not match.');
    if(member.passwordHash&&member.passwordHash!==await digest(String(payload.password)))throw Error('That email and password do not match.');
    sessionStorage.setItem(SESSION,member.id);return {member:adminView({members:[member]}).members[0]};
  }
  if(path==='/api/logout'){sessionStorage.removeItem(SESSION);return {ok:true};}
  if(path==='/api/contact'&&method==='POST'){
    const name=String(payload.name||'').trim(),email=String(payload.email||'').trim(),subject=String(payload.subject||'').trim(),text=String(payload.message||'').trim();
    if(!name||!subject||!text||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Enter your name, email, subject and message.');
    if(text.length>15000)throw Error('Please shorten your message.');
    if(payload.type==='Event RSVP'&&!value.content.events.some(event=>event.id===payload.eventId&&event.published&&!event.archived))throw Error('This event is no longer open for registration.');
    const message={id:id('message'),createdAt:stamp(),type:payload.type||'Contact',name,from:email,subject,text,status:'new',delivery:'demo',eventId:payload.eventId,location:payload.location||'',photoUrl:payload.photoUrl||''};
    if(message.type==='Volunteer story'){
      message.storyId=id('submitted');value.content.stories.push({id:message.storyId,title:subject,author:name,location:message.location,body:text,image:'',photoUrl:message.photoUrl,published:false,archived:false,example:false});
    }
    value.messages.push(message);revise(value.content);await write(value,revision);return {ok:true,id:message.id,delivery:'demo'};
  }
  const member=requireMember(value);
  if(path==='/api/demo/reset'&&method==='POST'){await write(await fresh());sessionStorage.setItem(SESSION,'demo-editor');return {ok:true};}
  if(path==='/api/admin/state'&&method==='GET')return adminView(value.content);
  if(path==='/api/admin/state'&&method==='PUT'){
    if(payload.revision!==revision)throw Error('The collection changed in another tab. Reload the office before saving again.');
    const content=copy(payload);validate(content);
    if(member.role!=='admin')content.members=value.content.members;
    else{
      const emails=new Set();
      for(const account of content.members){
        const email=String(account.email||'').trim().toLowerCase();
        if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||emails.has(email)||!['admin','editor'].includes(account.role))throw Error('Accounts need unique emails and a valid role.');emails.add(email);
        const prior=value.content.members.find(previous=>previous.id===account.id);
        if(account.password&&account.password.length<10)throw Error('Use at least 10 characters for a demo password.');
        account.passwordHash=account.password?await digest(account.password):prior?.passwordHash;
        if(!account.passwordHash)throw Error('Set a password for the new demo account.');delete account.password;
      }
    }
    revise(content);value.content=content;await write(value,revision);return adminView(content);
  }
  if(path==='/api/admin/inbox'&&method==='GET')return {messages:copy(value.messages)};
  if(path==='/api/admin/inbox'&&method==='PUT'){
    const message=value.messages.find(message=>message.id===payload.id);if(!message)throw Error('This message could not be found.');message.status=payload.status==='handled'?'handled':'new';revise(value.content);await write(value,revision);return {ok:true};
  }
  if(path==='/api/admin/upload'&&method==='POST'){
    const raw=atob(payload.data||'');
    if(raw.length>5*1024*1024)throw Error('Choose an image smaller than 5 MB.');
    const type=raw.startsWith('\x89PNG\r\n\x1a\n')?'png':raw.startsWith('\xff\xd8\xff')?'jpeg':raw.startsWith('RIFF')&&raw.slice(8,12)==='WEBP'?'webp':null;
    if(!type)throw Error('Choose a PNG, JPEG or WebP image.');
    return {url:`data:image/${type};base64,${payload.data}`};
  }
  throw Error('This action is unavailable in the front-end demo.');
}
