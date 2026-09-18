import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generatePrivateKey,privateKeyToAccount} from 'viem/accounts';
import {POST as auth,GET as session} from '../app/api/auth/[action]/route.ts';
import {GET as googleRoute} from '../app/api/auth/google/[step]/route.ts';
import {POST as challenge} from '../app/api/challenge/route.ts';
import {POST as savePlan,GET as listPlans} from '../app/api/plans/route.ts';
import {POST as publish,GET as posts} from '../app/api/posts/route.ts';
import {GET as freeContent} from '../app/api/free-content/route.ts';
import {POST as access} from '../app/api/access/route.ts';
import {POST as upload} from '../app/api/uploads/route.ts';
import {GET as media} from '../app/api/media/[id]/route.ts';
import {GET as account} from '../app/api/account/route.ts';
import {getAppUser,digest} from '../lib/auth.ts';
import {googleIdentity} from '../lib/google-auth.ts';
import {timedPreviewIsShort} from '../lib/preview-validation.ts';
import {sqlite,env} from './runtime.mjs';
import {state} from './unlock.mjs';
const origin='https://keytube.test',signer=privateKeyToAccount(generatePrivateKey()),wallet=signer.address.toLowerCase(),network=84532;
let checks=0;
const ok=name=>{checks++;console.log('PASS',name);};
function req(path,body,method='POST',extra={}) {return new Request(origin+path,{method,headers:{Origin:origin,Cookie:globalThis.testCookie||'','Content-Type':'application/json','cf-connecting-ip':'198.51.100.8',...extra},...(body?{body:JSON.stringify(body)}:{})});}
const action=(name,body)=>auth(req('/api/auth/'+name,body),{params:Promise.resolve({action:name})});
const useCookie=c=>{globalThis.testCookie=c;};
function cookie(r){return r.headers.get('set-cookie').split(';')[0];}
async function proof(purpose,data){const r=await challenge(req('/api/challenge',{purpose,wallet,network,...data}));assert.equal(r.status,200,await r.clone().text());const p=await r.json();return {wallet,challengeId:p.challengeId,signature:await signer.signMessage({message:p.message})};}
let r=await action('register',{name:'Ana Creadora',email:'ANA@example.test',password:'MiClaveLarga-123!'});assert.equal(r.status,201,await r.clone().text());const ana=(await r.json()).user,anaCookie=cookie(r);
assert.match(r.headers.get('set-cookie'),/HttpOnly/);assert.match(r.headers.get('set-cookie'),/Secure/);assert.match(r.headers.get('set-cookie'),/SameSite=Lax/);
const stored=sqlite.prepare('SELECT * FROM users WHERE id=?').get(ana.id);assert.match(stored.password_hash,/^scrypt\$/);assert.ok(!stored.password_hash.includes('MiClave'));assert.equal(stored.email,'ana@example.test');
assert.notEqual(sqlite.prepare('SELECT token_hash FROM sessions').get().token_hash,anaCookie.split('=')[1]);ok('Registration stores scrypt hashes and only hashed, HttpOnly session tokens');
useCookie('');r=await action('register',{name:'Bruno Creador',email:'bruno@example.test',password:'OtraClaveLarga-123!'});assert.equal(r.status,201);const bruno=(await r.json()).user,brunoCookie=cookie(r);assert.notEqual(ana.id,bruno.id);
useCookie(anaCookie);assert.equal((await getAppUser()).userId,ana.id);assert.equal((await (await account()).json()).profile.name,'Ana Creadora');useCookie(brunoCookie);assert.equal((await getAppUser()).userId,bruno.id);ok('Independent accounts resolve different sessions and profiles');
useCookie('keytube_session='+ '0'.repeat(64));assert.equal(await getAppUser(),null);ok('A fabricated session cannot impersonate another user');
useCookie('');r=await action('login',{email:'ana@example.test',password:'Incorrecta-12345'});assert.equal(r.status,401);r=await action('login',{email:'ana@example.test',password:'MiClaveLarga-123!'});assert.equal(r.status,200);const fresh=cookie(r);useCookie(fresh);r=await action('logout',{});assert.equal(r.status,200);assert.equal(await getAppUser(),null);ok('Correct passwords create sessions; wrong passwords and revoked sessions are rejected');
r=await auth(req('/api/auth/register',{name:'Atacante',email:'evil@example.test',password:'ClaveMuyLarga123' },'POST',{Origin:'https://evil.test'}),{params:Promise.resolve({action:'register'})});assert.equal(r.status,403);ok('Account mutations reject cross-origin submissions');
useCookie(anaCookie);
const basic={slot:'basic',name:'Básico de Ana',description:'Mi comunidad',benefits:['Artículos e imágenes completos'],coverage:['text','image','audio'],price:'0.001',durationDays:30,network,lock:'0x1111111111111111111111111111111111111111'};
const premium={...basic,slot:'premium',name:'Premium de Ana',coverage:['video','audio','image','document','text'],lock:'0x2222222222222222222222222222222222222222'};
async function save(plan){return savePlan(req('/api/plans',{plan,...await proof('plan',{plan})}));}
r=await save({...basic,price:'99'});assert.equal(r.status,409);ok('A claimed price that differs from the PublicLock price is rejected');
state.manager=false;r=await save(basic);assert.equal(r.status,403);state.manager=true;ok('Only a real Lock manager can bind a plan');
r=await save(basic);assert.equal(r.status,200,await r.clone().text());const basicId=(await r.json()).plan.id;
const draft={creator:'Ana Creadora',title:'Lección exclusiva de Ana',intro:'Esta introducción es pública y está disponible para toda la comunidad.',body:'SECRETO_DE_ANA. Esta lección completa solo se entrega cuando una membresía válida concede acceso.',type:'text',category:'Educación',visibility:'members',planId:basicId,lock:basic.lock,network};
r=await publish(req('/api/posts',{draft,...await proof('publish',{draft})}));assert.equal(r.status,201,await r.clone().text());const basicPost=(await r.json()).post;
r=await save(premium);assert.equal(r.status,200,await r.clone().text());const premiumId=(await r.json()).plan.id;
assert.equal(sqlite.prepare('SELECT premium_lock FROM posts WHERE id=?').get(basicPost.id).premium_lock,premium.lock);ok('Creating Premium also enables it for previously published Básico content');
const premiumDraft={...draft,title:'Solo para Premium',lock:premium.lock,planId:premiumId};r=await publish(req('/api/posts',{draft:premiumDraft,...await proof('publish',{draft:premiumDraft})}));assert.equal(r.status,201);const premiumPost=(await r.json()).post;
state.valid=false;state.locks={[premium.lock]:true};r=await access(req('/api/access',{postId:basicPost.id,...await proof('read',{postId:basicPost.id})}));assert.equal(r.status,200);assert.equal((await r.json()).body,draft.body);ok('A valid Premium Key opens Básico content');
state.locks={[basic.lock]:true};r=await access(req('/api/access',{postId:premiumPost.id,...await proof('read',{postId:premiumPost.id})}));assert.equal(r.status,403);ok('A Básico Key cannot open Premium-only content');
state.locks={};r=await access(req('/api/access',{postId:basicPost.id,...await proof('read',{postId:basicPost.id})}));assert.equal(r.status,403);ok('No membership means no private body, regardless of login');
useCookie(brunoCookie);r=await publish(req('/api/posts',{draft,...await proof('publish',{draft})}));assert.equal(r.status,403);r=await save(basic);assert.equal(r.status,409);ok('Another application account cannot publish under or claim the creator’s plan');
useCookie(anaCookie);r=await save({...premium,coverage:['video']});assert.equal(r.status,400);ok('Premium cannot remove the formats promised by Básico');
const bytes=readFileSync(new URL('../public/images/hero.jpg',import.meta.url));
const uploadReq=(data,mime,role)=>new Request(origin+'/api/uploads?role='+role,{method:'POST',headers:{Origin:origin,'Content-Type':mime,Cookie:globalThis.testCookie||'','X-File-Name':'test'},body:data});
r=await upload(uploadReq(bytes,'image/jpeg','full'));assert.equal(r.status,201);const freeAsset=(await r.json()).asset;
const freeDraft={...draft,title:'Fotografía gratuita',type:'image',body:'Notas públicas',visibility:'free',planId:null,lock:'',assetId:freeAsset.id};
r=await publish(req('/api/posts',{draft:freeDraft}));assert.equal(r.status,201,await r.clone().text());const freePost=(await r.json()).post;
useCookie('');r=await freeContent(req('/api/free-content?post='+freePost.id,undefined,'GET'));assert.equal(r.status,200);const free=await r.json();assert.equal(free.body,freeDraft.body);r=await media(req(free.mediaUrl,undefined,'GET'),{params:Promise.resolve({id:freeAsset.id})});assert.equal(r.status,200);assert.deepEqual(Buffer.from(await r.arrayBuffer()),bytes);ok('Free content is published without wallet proof and readable without login');
r=await freeContent(req('/api/free-content?post='+basicPost.id,undefined,'GET'));assert.equal(r.status,403);r=await media(req('/api/media/'+freeAsset.id+'?public='+basicPost.id,undefined,'GET'),{params:Promise.resolve({id:freeAsset.id})});assert.equal(r.status,403);assert.ok(!(await (await posts(req('/api/posts',undefined,'GET'))).text()).includes('SECRETO_DE_ANA'));ok('Changing a public URL parameter cannot expose member content');
function wav(seconds){const rate=8000,length=rate*seconds,b=Buffer.alloc(44+length*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVE',8);b.write('fmt ',12);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(length*2,40);return b;}
assert.equal(timedPreviewIsShort(wav(10),'audio/wav'),true);assert.equal(timedPreviewIsShort(wav(11),'audio/wav'),false);useCookie(anaCookie);r=await upload(uploadReq(wav(11),'audio/wav','preview'));assert.equal(r.status,400);r=await upload(uploadReq(wav(10),'audio/wav','preview'));assert.equal(r.status,201);ok('Server accepts a 10-second audio preview and rejects an 11-second preview');
const sampleMP4=Buffer.from('000000186674797069736F6D0000020069736F6D','hex');r=await upload(uploadReq(sampleMP4,'video/mp4','preview'));assert.equal(r.status,400);ok('Unvalidated MP4 originals cannot be uploaded as timed previews');
// Google cryptographic verification uses generated keys; no real account or credential.
env.GOOGLE_CLIENT_ID='client.test';env.GOOGLE_CLIENT_SECRET='test-only';env.APP_ORIGIN=origin;
const keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk=await crypto.subtle.exportKey('jwk',keys.publicKey);jwk.kid='test-key';jwk.alg='RS256';jwk.use='sig';
const now=Math.floor(Date.now()/1000),claims={iss:'https://accounts.google.com',aud:'client.test',sub:'google-ana',email:'ana@example.test',email_verified:true,name:'Ana Google',nonce:'nonce-test',iat:now,exp:now+300};
async function token(claims){const header=Buffer.from(JSON.stringify({alg:'RS256',kid:jwk.kid})).toString('base64url'),payload=Buffer.from(JSON.stringify(claims)).toString('base64url'),data=header+'.'+payload;return data+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',keys.privateKey,Buffer.from(data))).toString('base64url');}
const realFetch=globalThis.fetch;let tokenClaims=claims;
globalThis.fetch=async url=>{if(String(url).includes('oauth2/v3/certs'))return Response.json({keys:[jwk]});if(String(url)==='https://oauth2.googleapis.com/token')return Response.json({id_token:await token(tokenClaims)});throw new Error('Unexpected external request '+url);};
assert.equal((await googleIdentity(await token(claims),'nonce-test')).sub,'google-ana');const validToken=await token(claims);const tampered=validToken.split('.');tampered[1]=Buffer.from(JSON.stringify({...claims,sub:'attacker'})).toString('base64url');await assert.rejects(()=>googleIdentity(tampered.join('.'),'nonce-test'));
await assert.rejects(()=>token({...claims,aud:'another-client'}).then(t=>googleIdentity(t,'nonce-test')));await assert.rejects(()=>token({...claims,email_verified:false}).then(t=>googleIdentity(t,'nonce-test')));await assert.rejects(()=>token({...claims,exp:now-1}).then(t=>googleIdentity(t,'nonce-test')));await assert.rejects(()=>googleIdentity(validToken,'wrong-nonce'));ok('Google identity requires a valid signature, audience, verified email and expiry');
async function google(path){return googleRoute(req(path,undefined,'GET'),{params:Promise.resolve({step:path.includes('/start')?'start':'callback'})});}
useCookie('');r=await google('/api/auth/google/start');assert.equal(r.status,303);let oauthCookie=cookie(r),url=new URL(r.headers.get('location')),oauthState=url.searchParams.get('state');tokenClaims={...claims,nonce:url.searchParams.get('nonce')};useCookie(oauthCookie);r=await google('/api/auth/google/callback?code=test&state='+oauthState);assert.equal(r.status,303);assert.equal(new URL(r.headers.get('location')).search,'');assert.equal(sqlite.prepare('SELECT google_sub FROM users WHERE id=?').get(ana.id).google_sub,claims.sub);ok('A verified Google email can reuse the existing KeyTube account without creating a duplicate');
useCookie(anaCookie);r=await google('/api/auth/google/start?link=1');assert.equal(r.status,303);oauthCookie=cookie(r);url=new URL(r.headers.get('location'));oauthState=url.searchParams.get('state');tokenClaims={...claims,nonce:url.searchParams.get('nonce')};useCookie(anaCookie+'; '+oauthCookie);r=await google('/api/auth/google/callback?code=test&state='+oauthState);assert.equal(r.status,303);assert.equal(new URL(r.headers.get('location')).search,'');assert.equal(sqlite.prepare('SELECT google_sub FROM users WHERE id=?').get(ana.id).google_sub,claims.sub);ok('An authenticated user can explicitly link their verified Google identity');
r=await google('/api/auth/google/callback?code=test&state='+oauthState);assert.equal(new URL(r.headers.get('location')).searchParams.get('authError'),'google_expired');ok('Google authorization state is single-use');
globalThis.fetch=realFetch;
useCookie(brunoCookie);sqlite.prepare('UPDATE sessions SET expires_at=0 WHERE token_hash=?').run(await digest(brunoCookie.split('=')[1]));assert.equal(await getAppUser(),null);ok('Expired application sessions cannot access a creator account');
console.log(`${checks} account, plan and preview checks passed. SQLite, password hashes, EVM signatures and Google signature verification are real; chain state and Google HTTP are fixtures.`);
