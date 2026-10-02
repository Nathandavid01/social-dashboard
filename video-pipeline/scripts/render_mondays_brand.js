// Reusable deterministic motion composition. Existing logo is composited, never redrawn.
const {createCanvas,loadImage,GlobalFonts}=require('@napi-rs/canvas');
const {spawn}=require('child_process');const {once}=require('events');const fs=require('fs');const path=require('path');
const root='/Volumes/Extreme SSD/Nate Media/mondays-rec-sept28/brand';
const version=process.argv[2]||'v10';const backgroundMode=process.argv[3]||'warm';const output=path.join(root,`mondays-outro-visual-${version}.mp4`);
if(fs.existsSync(output))throw Error('Use a new version');
const W=1080,H=1920,FPS=60,DUR=5.8,O='#FF762D',Y='#FFE174';
GlobalFonts.registerFromPath(path.resolve(__dirname,'../media/mondays/brand/AvenirNext-DemiBold.ttf'),'Mondays');
const clamp=x=>Math.max(0,Math.min(1,x));const ease=x=>1-Math.pow(1-clamp(x),3);const smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
const back=x=>{x=clamp(x);return 1+2.15*Math.pow(x-1,3)+1.15*Math.pow(x-1,2)};
const lerp=(a,b,p)=>a+(b-a)*p;
const canvas=createCanvas(W,H),c=canvas.getContext('2d');
function strokePath(ctx,points,width,col,alpha=1){ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle=col;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.stroke();ctx.restore()}
function star(x,y,r,a,col,alpha){c.save();c.translate(x,y);c.rotate(a);c.globalAlpha=alpha;c.fillStyle=col;c.beginPath();for(let j=0;j<16;j++){let rr=j%2?r*.62:r,aa=j*Math.PI/8-Math.PI/2;j?c.lineTo(Math.cos(aa)*rr,Math.sin(aa)*rr):c.moveTo(0,-rr)}c.closePath();c.fill();c.restore()}
function tracked(text,x,y,size,spacing,color,alpha=1){c.save();c.globalAlpha=alpha;c.font=`${size}px Mondays`;c.fillStyle=color;c.textBaseline='middle';let chars=[...text],width=chars.reduce((n,k)=>n+c.measureText(k).width,0)+spacing*(chars.length-1);let xx=x-width/2;for(const k of chars){c.fillText(k,xx,y);xx+=c.measureText(k).width+spacing}c.restore()}
function pill(x,y,w,h,r,color){c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=color;c.fill()}

// Animated lighting and large curved color fields keep the center clear for the lockup.
function drawBackground(t){
 const dark=backgroundMode==='dark';
 let g=c.createLinearGradient(0,0,W,H);
 if(dark){g.addColorStop(0,'#37291C');g.addColorStop(.52,'#241D14');g.addColorStop(1,'#4F3520');}
 else{g.addColorStop(0,'#F9B44B');g.addColorStop(.32,'#FFE9A0');g.addColorStop(.7,'#FFEBAF');g.addColorStop(1,'#F7AB43');}
 c.fillStyle=g;c.fillRect(0,0,W,H);
 const drift=Math.sin(t*.55)*95;
 let light=c.createRadialGradient(520+drift,830,80,520+drift,830,1010);
 light.addColorStop(0,dark?'rgba(255,204,97,0.13)':'rgba(255,251,224,0.9)');
 light.addColorStop(.60,dark?'rgba(255,153,43,0.055)':'rgba(255,237,166,0.3)');light.addColorStop(1,'rgba(255,169,53,0)');
 c.fillStyle=light;c.fillRect(0,0,W,H);
 c.save();c.globalAlpha=dark?.13:.22;c.fillStyle=O;c.beginPath();
 c.moveTo(-120,-100);c.bezierCurveTo(500+drift,-20,540,170,1010,210);c.bezierCurveTo(1120,220,1190,170,1210,70);c.lineTo(1200,-100);c.closePath();c.fill();
 c.globalAlpha=dark?.2:.52;c.fillStyle=Y;c.beginPath();c.moveTo(-140,1810);c.bezierCurveTo(220,1580+drift*.3,620,1780,1240,1420);c.lineTo(1220,2060);c.lineTo(-120,2060);c.closePath();c.fill();
 c.globalAlpha=dark?.22:.26;c.fillStyle=O;c.beginPath();c.moveTo(-130,1950);c.bezierCurveTo(320,1740,840,1900+drift*.3,1180,1580);c.lineTo(1250,2050);c.closePath();c.fill();c.restore();
 // Soft moving rim light, restricted to the edge so it cannot wash out the logo.
 const rim=c.createRadialGradient(1100+Math.sin(t*.7)*70,300,0,1100,300,650);
 rim.addColorStop(0,dark?'rgba(255,153,50,0.42)':'rgba(255,174,56,0.38)');rim.addColorStop(1,'rgba(255,174,56,0)');c.fillStyle=rim;c.fillRect(0,0,W,H);
}

(async()=>{
 const logo=await loadImage(path.join(root,'mondays-logo-recreated-v2.png'));
 const ff=spawn('/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg',['-v','error','-n','-f','rawvideo','-pixel_format','rgba','-video_size',`${W}x${H}`,'-framerate',String(FPS),'-i','pipe:0','-an','-c:v','libx264','-preset','fast','-crf','17','-threads','4','-pix_fmt','yuv420p','-movflags','+faststart',output],{stdio:['pipe','ignore','pipe']});let err='';ff.stderr.on('data',d=>err+=d);const done=once(ff,'close');
 for(let frame=0;frame<DUR*FPS;frame++){
  const t=frame/FPS;c.resetTransform();c.globalAlpha=1;drawBackground(t);
  // Broad paired curves travel across the composition like a drawn smile.
  if(t<1.65){let p=smooth((t-.12)/1.05),tail=Math.max(0,p-.48);for(let lane=0;lane<2;lane++){
   let pts=[];for(let u=tail;u<=p;u+=.005){let x=-320+1750*u,y=680+380*Math.sin(Math.PI*u)-330*u+lane*96;pts.push([x,y])}
   if(pts.length>1)strokePath(c,pts,lane?66:112,lane?O:Y,1-smooth((t-1.2)/.35));
  }}
  // A soft radial accent follows the emblem's retreat; gone before the lockup.
  let retreat=ease(t/.75),travel=smooth((t-.62)/.72);
  let sx=lerp(540,311,travel)+Math.sin(travel*Math.PI)*135,sy=lerp(820,716,travel)-Math.sin(travel*Math.PI)*210;
  let size=lerp(850,290,retreat);size=lerp(size,180,travel);let turn=-.40*(1-retreat)+.30*Math.sin(Math.PI*travel);
  // Reveal the original wordmark outward from the arriving O, with a light settle.
  const reveal=ease((t-1.20)/.45);if(reveal>0){
   c.save();const settle=(1-back((t-1.20)/.55))*22;c.translate(0,settle);c.beginPath();c.rect(311-260*reveal,575,960*reveal,320);c.clip();c.globalAlpha=clamp((t-1.20)/.22);c.save();c.beginPath();c.rect(0,0,W,H);c.rect(219,610,184,220);c.clip('evenodd');c.drawImage(logo,45,130,2050,425,70,620,940,940*425/2050);c.restore();if(t>1.34){c.save();c.beginPath();c.rect(219,610,184,220);c.clip();c.globalAlpha=smooth((t-1.34)/.17);c.drawImage(logo,45,130,2050,425,70,620,940,940*425/2050);c.restore();}c.restore();
  }
  const sunAlpha=1-smooth((t-1.37)/.17);
  if(sunAlpha>0){
   c.save();c.translate(sx,sy);c.rotate(turn);c.scale(size/392,size/398);
   c.globalAlpha=sunAlpha;c.shadowColor='rgba(255,118,45,0.16)';c.shadowBlur=28;c.shadowOffsetY=15;c.beginPath();c.arc(0,0,192,0,Math.PI*2);c.clip();
   c.drawImage(logo,375,140,392,398,-196,-199,392,398);c.restore();
  }
  // Small branded sunbursts punctuate the arrival, then move out of the reading area.
  for(let i=0;i<5;i++){let u=(t-1.16-i*.035)/.63;if(u>0&&u<1){let angle=(i*1.3)-2.7,rr=130+ease(u)*215;star(540+Math.cos(angle)*rr,725+Math.sin(angle)*rr,8+Math.sin(Math.PI*u)*13,u*2,i%2?O:Y,Math.sin(Math.PI*u)*.85)}}
  // The slogan arrives word-by-word; the yellow smile acts as a moving underline.
  const words=[['LA',390,900,1.65],['SONRISA',594,900,1.76]];
  for(const [word,x,y,at] of words){let p=back((t-at)/.55);if(t>=at){c.save();c.beginPath();c.rect(130,850,820,108);c.clip();tracked(word,x,y+(1-p)*90,52,1.8,O,clamp((t-at)/.14));c.restore()}}
  const sw=ease((t-1.98)/.58);if(sw>0){
   c.save();c.translate(540,1009);c.rotate(-.025);c.scale(sw,1);pill(-337,-57,674,115,57,Y);c.restore();
  }
  const sabor=back((t-2.04)/.6);if(t>2.04){c.save();c.beginPath();c.rect(150,943,780,135);c.clip();tracked('DEL SABOR',540,1005+(1-sabor)*110,79,1.4,O,clamp((t-2.04)/.15));c.restore()}
  // Contact resolves as a single group, giving the final card almost three seconds.
  const contact=ease((t-2.58)/.56);if(contact>0){
   c.save();c.globalAlpha=contact;const yy=(1-contact)*55;
   tracked('AGUADILLA, PUERTO RICO',540,1159+yy,30,3,O);
   c.translate(540,1260+yy);const ps=lerp(.86,1,back((t-2.70)/.55));c.scale(ps,ps);pill(-286,-55,572,110,55,O);
   tracked('(787) 659-0122',0,0,46,1,'#FFFFFF');c.restore();
  }
  // Edge accents keep the final frame lively while the logo and contact stay still.
  const edge=ease((t-2.75)/.8);if(edge>0){
   c.save();c.globalAlpha=.65*edge;strokePath(c,[[-80,1500],[80,1490],[230,1440]],14,Y);strokePath(c,[[895,440],[1040,400],[1170,430]],11,Y);c.restore();
   star(143,1400,14,Math.sin(t*.75)*.2,O,edge*.8);star(927,503,20,-t*.14,Y,edge);
  }
  if([12,42,72,108,144,198,300].includes(frame))fs.writeFileSync(path.join(root,`outro-${version}-${frame}.png`),canvas.toBuffer('image/png'));
  const buf=Buffer.from(c.getImageData(0,0,W,H).data.buffer);if(!ff.stdin.write(buf))await once(ff.stdin,'drain');
  if(frame%120===0)console.log(`Rendered ${frame}/${DUR*FPS}`);
 }
 ff.stdin.end();const [code]=await done;if(code)throw Error(err);console.log(output);
 fs.writeFileSync(path.join(root,`outro-${version}-motion.json`),JSON.stringify({version,duration:DUR,fps:FPS,palette:[O,Y],background:backgroundMode,phone:'(787) 659-0122',phone_source:'user confirmation 2026-10-02',cues:[{time:.12,kind:'swoosh',action:'smile ribbons'},{time:1.02,kind:'soft_hit',action:'logo settles'},{time:1.65,kind:'tap',action:'LA'},{time:1.76,kind:'tap',action:'SONRISA'},{time:1.98,kind:'swoosh',action:'yellow underline'},{time:2.70,kind:'soft_hit',action:'phone resolves'}]},null,2));
})().catch(e=>{console.error(e);process.exit(1)});
