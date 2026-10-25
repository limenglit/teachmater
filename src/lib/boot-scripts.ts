/**
 * 文档头部的内联启动脚本（原 index.html 中的脚本）。
 * - 扫码页：首帧骨架（带秒数提示）+ 双路对冲预取（本站转发优先，直连作为第二路）。
 * - 启动看门狗：弱网/旧缓存导致页面代码没跑起来时，自动带防缓存参数重开一次，再不行给出提示与重试按钮。
 * 这些脚本在页面代码下载前就运行，只能用 ES5 写法。
 */
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const DIRECT = String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");

export const SCAN_BOOT_SCRIPT = `(function(){try{
var p=location.pathname.toLowerCase();
var K=${JSON.stringify(KEY)};
var BS=['/api/public/sb/rest/v1/rpc/',${JSON.stringify(DIRECT + "/rest/v1/rpc/")}];
function hp(q){return new Promise(function(res){
  var n=0,live=0,done=false;
  function fin(v){if(!done){done=true;res(v);}}
  function go(){var u=BS[n%2]+q;n++;live++;
    fetch(u,{cache:'no-store'}).then(function(r){return r.ok?r.json():null})['catch'](function(){return null})
      .then(function(j){live--;if(done)return;if(j){fin(j);return;}
        if(live>0)return;if(n<3)setTimeout(function(){if(!done&&live===0)go();},250);else fin(null);});
  }
  go();
  setTimeout(function(){if(!done&&n<2)go();},350);
  setTimeout(function(){fin(null);},9000);
});}
function pf(id,fn,arg){if(!window.fetch||!window.Promise)return;window.__TM_PREFETCH__={id:id,fn:fn,p:hp(fn+'?'+arg+'='+id+'&apikey='+K)};}
function tick(base){
  var t0=Date.now();var iv=setInterval(function(){
    var el=document.getElementById('tm-boot-tip');
    if(!el){if(window.__TM_APP_MOUNTED__)clearInterval(iv);return;}
    var s=Math.floor((Date.now()-t0)/1000);
    if(s>=3)el.innerHTML=base+'（第 '+s+' 秒）'+(s>=5?'<div style="margin-top:6px;font-size:12px;line-height:1.6;opacity:.85">教室网络较慢，请勿关闭页面<br>系统正在自动重试</div>':'');
  },1000);
}
var seat=p.indexOf('/seat-checkin/')===0;
if(p.indexOf('/checkin/')===0||seat){
  try{var m=p.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
    if(m)pf(m[0],seat?'get_seat_checkin_session_for_student':'get_checkin_session_for_student','p_session_id');}catch(e2){}
  window.__TM_BOOT_HTML__='<div style="position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:24px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,\\'PingFang SC\\',\\'Microsoft YaHei\\',sans-serif"><div style="font-size:40px">📋</div><div style="font-size:18px;font-weight:600">签到 · Check-in</div><div style="width:100%;max-width:320px;height:48px;border-radius:10px;border:2px solid rgba(100,116,139,.25)"></div><div style="width:100%;max-width:320px;height:48px;border-radius:10px;background:rgba(37,99,235,.35)"></div><div id="tm-boot-tip" style="font-size:13px;opacity:.65">正在连接签到… Loading</div></div>';
  tick('正在连接签到…');
}else if(/^\\/(quiz|poll|discuss|task)\\//.test(p)||/^\\/board\\/[^/]+\\/submit/.test(p)){
  try{var mm=p.match(/^\\/(quiz|poll|discuss|board)\\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/);
    if(mm){var F={quiz:['get_quiz_session_for_student','p_session_id'],poll:['get_poll_for_voter','p_poll_id'],discuss:['get_discussion_topic_for_student','p_topic_id'],board:['get_board_for_student','p_board_id']}[mm[1]];pf(mm[2],F[0],F[1]);}}catch(e3){}
  window.__TM_BOOT_HTML__='<div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;font-family:-apple-system,\\'PingFang SC\\',sans-serif"><div id="tm-boot-tip" style="opacity:.65">正在打开… Loading</div></div>';
  tick('正在打开…');
}
}catch(e){}})();`;

export const WATCHDOG_SCRIPT = `(function(){
var shown=false,jsErr=false;
var path=location.pathname.toLowerCase();
var scanPage=path.indexOf('/seat-checkin/')===0?'seat-checkin':(path.indexOf('/checkin/')===0?'checkin':'');
function root(){return document.getElementById('tm-boot')||document.body;}
function diag(stage,msg){
  if(!scanPage)return;
  try{
    var ua=navigator.userAgent||'';var m=path.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
    var row={p_session_id:m?m[0]:null,p_page:'boot-'+scanPage,p_ok:false,p_stage:stage,
      p_error:String(msg).slice(0,300)+' | js='+(window.__TM_ENTRY_RAN__?1:0)+' r='+(/[?&]_r=\\d+/.test(location.search)?1:0)+' net='+(navigator.onLine===false?0:1),
      p_elapsed_ms:Math.round(window.performance&&performance.now?performance.now():0),p_attempts:0,p_ua:ua.slice(0,400),
      p_ios_version:((ua.match(/OS (\\d+[_.]\\d+(?:[_.]\\d+)?) like Mac OS X/)||[])[1]||'').replace(/_/g,'.'),
      p_wechat_version:(ua.match(/MicroMessenger\\/([\\d.]+)/i)||[])[1]||''};
    var s=JSON.stringify(row),QK='tm-diag-queue',q=[];
    try{q=JSON.parse(localStorage.getItem(QK)||'[]');q.push(row);localStorage.setItem(QK,JSON.stringify(q.slice(-20)));}catch(_){}
    if(!window.fetch)return;
    var H={'Content-Type':'application/json',apikey:${JSON.stringify(KEY)}};
    function ok(r){if(r.status>=500)return;try{var a=JSON.parse(localStorage.getItem(QK)||'[]'),b=[];for(var i=0;i<a.length;i++)if(JSON.stringify(a[i])!==s)b.push(a[i]);if(b.length)localStorage.setItem(QK,JSON.stringify(b));else localStorage.removeItem(QK);}catch(_){}}
    fetch('/api/public/sb/rest/v1/rpc/log_scan_diagnostic',{method:'POST',keepalive:true,headers:H,body:s}).then(ok)['catch'](function(){
      fetch(${JSON.stringify(DIRECT + "/rest/v1/rpc/log_scan_diagnostic")},{method:'POST',keepalive:true,headers:H,body:s}).then(ok)['catch'](function(){});
    });
  }catch(e){}
}
function show(msg){
  if(shown||window.__TM_APP_MOUNTED__)return;shown=true;
  diag('boot-fail',msg);
  var r=root();if(!r)return;
  r.innerHTML='<div style="position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center;font-size:15px;line-height:1.7;background:#fff;color:#0f172a;z-index:2147483647">'+
    '<div>'+msg+'</div>'+
    '<button id="tm-retry" style="padding:10px 26px;border-radius:999px;border:1px solid #2563eb;background:#2563eb;color:#fff;font-size:15px">重新加载</button>'+
    '<div style="font-size:12px;opacity:.6">仍打不开：切换 4G/5G 与 Wi-Fi，或点右上角「…」在浏览器中打开</div></div>';
  document.getElementById('tm-retry').onclick=function(){
    var u=location.href.replace(/([?&])_r=\\d+/,'');
    location.replace(u+(u.indexOf('?')>-1?'&':'?')+'_r='+Date.now());
  };
}
function heal(msg,why){
  if(window.__TM_APP_MOUNTED__)return;
  var k='tm-auto-heal',done=false;
  try{done=sessionStorage.getItem(k)==='1';if(!done)sessionStorage.setItem(k,'1');}catch(_){done=/[?&]_r=\\d+/.test(location.search);}
  if(done){show(msg);return;}
  diag('boot-heal',why||msg);
  var u=location.href.replace(/([?&])_r=\\d+&?/,'$1').replace(/[?&]$/,'');
  location.replace(u+(u.indexOf('?')>-1?'&':'?')+'_r='+Date.now());
}
// 页面代码下载状态：任一预载文件还没下载完 → loading（弱网，刷新反而从头再下）；都已下载完 → done。
function entryState(){
  try{var ls=document.querySelectorAll('link[rel="modulepreload"][href]');if(!ls.length||!window.performance||!performance.getEntriesByName)return '?';
    for(var i=0;i<ls.length;i++){if(!performance.getEntriesByName(ls[i].href).length)return 'loading';}
    return 'done';}catch(_){return '?';}
}
window.__TM_BOOT_FAIL__=show;
window.addEventListener('error',function(e){
  var t=e&&e.target;
  if(t&&t.tagName==='SCRIPT'&&t.type==='module'){heal('页面资源加载失败（网络不稳定）。','entry-script-error');return;}
  if(!jsErr&&!window.__TM_APP_MOUNTED__&&e&&e.message){jsErr=true;diag('boot-js',e.message+' @'+String(e.filename||'').split('/').pop()+':'+(e.lineno||0));}
},true);
setTimeout(function(){
  if(window.__TM_ENTRY_RAN__)return;
  var st=entryState();
  if(st==='loading')diag('boot-slow','entry-loading-25s');
  else heal('页面资源加载失败（网络不稳定）。','no-entry-25s:'+st);
},25000);
setTimeout(function(){if(!window.__TM_ENTRY_RAN__)heal('页面资源加载失败（网络不稳定）。','no-entry-40s:'+entryState());},40000);
setTimeout(function(){show('页面加载较慢，可能是网络不稳定。');},50000);
})();`;

export const NOMODULE_SCRIPT = `document.addEventListener('DOMContentLoaded',function(){document.body.innerHTML='<div style="padding:32px 20px;text-align:center;font-size:15px;line-height:1.7">当前浏览器版本过旧，无法打开页面。<br>请升级系统/微信，或点击右上角「…」选择「在浏览器打开」。</div>';});`;

export const CRITICAL_CSS = `html, body { margin: 0; padding: 0; background: #ffffff; color: #0f172a; -webkit-font-smoothing: antialiased; }
body { font-family: "Noto Sans SC", system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; }
@media (prefers-color-scheme: dark) { html, body { background: #0f172a; color: #f1f5f9; } }
.app-boot { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 14px; pointer-events: none; }
.app-boot__title { font-size: 18px; font-weight: 600; opacity: 0.85; letter-spacing: 0.02em; }
.app-boot__spinner { width: 28px; height: 28px; border-radius: 50%; border: 2px solid rgba(15,23,42,0.12); border-top-color: #2563eb; animation: app-boot-spin 0.9s linear infinite; }
@media (prefers-color-scheme: dark) { .app-boot__spinner { border-color: rgba(241,245,249,0.18); border-top-color: #60a5fa; } }
@keyframes app-boot-spin { to { transform: rotate(360deg); } }`;
