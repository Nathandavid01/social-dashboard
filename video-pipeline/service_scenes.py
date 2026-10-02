"""Local 3D service illustrations with orthographic camera and material lighting."""
import math
import numpy as np
from PIL import Image,ImageDraw,ImageFilter
WHITE=(229,241,242);NAVY=(31,72,89);LIME=(156,230,8);CYAN=(70,172,192)
class Scene:
 def __init__(self):self.faces=[]
 def box(self,c,s,color):
  x,y,z=c;a,b,h=np.array(s)/2
  p=[(x-a,y-b,z-h),(x+a,y-b,z-h),(x+a,y+b,z-h),(x-a,y+b,z-h),(x-a,y-b,z+h),(x+a,y-b,z+h),(x+a,y+b,z+h),(x-a,y+b,z+h)]
  for ix in [(0,3,2,1),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)]:self.faces.append(([p[i] for i in ix],color))
 def cylinder(self,c,r,h,col,n=40):
  x,y,z=c;bottom=[(x+r*math.cos(i*2*math.pi/n),y+r*math.sin(i*2*math.pi/n),z) for i in range(n)];top=[(a,b,z+h) for a,b,_ in bottom]
  self.faces.append((top,col))
  for i in range(n):j=(i+1)%n;self.faces.append(([bottom[i],bottom[j],top[j],top[i]],col))
 def roof(self,x,y,z):
  a,b=.88,.75
  for p in [[(x-a,y-b,z),(x,y-b,z+.6),(x,y+b,z+.6),(x-a,y+b,z)],[(x,y-b,z+.6),(x+a,y-b,z),(x+a,y+b,z),(x,y+b,z+.6)],[(x-a,y-b,z),(x+a,y-b,z),(x,y-b,z+.6)]]:self.faces.append((p,NAVY))
def make(kind):
 s=Scene()
 if kind=='home':
  s.box((-.8,.15,.65),(1.55,1.25,1.3),WHITE);s.roof(-.8,.15,1.3);s.box((-.8,-.49,.42),(.38,.035,.84),CYAN);s.box((-1.23,-.49,.88),(.28,.04,.3),NAVY)
  s.box((1,-.45,.55),(1.15,.55,.95),NAVY);s.box((1,-.45,1.09),(.45,.14,.18),CYAN);s.box((1,-.745,.57),(.17,.04,.52),LIME);s.box((1,-.75,.57),(.52,.04,.17),LIME)
 elif kind=='bed':
  s.box((0,0,.44),(2.4,1.35,.2),NAVY);s.box((0,0,.65),(2.25,1.25,.25),WHITE);s.box((.35,0,.8),(1.45,1.26,.08),CYAN);s.box((-.77,0,.82),(.5,.86,.15),WHITE)
  for x in [-1.22,1.22]:
   s.box((x,0,.73),(.09,1.43,1.0),NAVY)
   for y in [-.57,.57]:s.cylinder((x,y,.02),.12,.1,NAVY)
  s.box((1.24,-.73,.76),(.05,.03,.36),LIME)
 elif kind=='center':
  s.box((0,0,.9),(2.5,1,1.8),WHITE);s.box((0,0,1.85),(2.7,1.15,.1),NAVY)
  for x in [-.85,-.3,.3,.85]:
   for z in [.65,1.35]:s.box((x,-.52,z),(.32,.04,.34),CYAN)
  s.box((0,-.53,.36),(.42,.05,.7),NAVY);s.box((0,-.72,.88),(.76,.48,.07),LIME)
  s.cylinder((-1.65,-.45,.05),.25,.2,NAVY);s.cylinder((-1.65,-.45,.25),.31,.55,LIME)
 elif kind=='culture':
  s.cylinder((-.42,-.1,.10),1.03,.17,NAVY);s.cylinder((-.42,-.1,.27),1,.11,WHITE);s.cylinder((-.42,-.1,.38),.91,.025,(128,195,179))
  for x,y,r in [(-.7,-.4,.12),(-.15,.05,.1),(-.65,.27,.075),(-.02,-.36,.075)]:s.cylinder((x,y,.409),r,.025,LIME)
  # Lid floats above and behind the culture dish.
  s.cylinder((.38,.95,.66),.9,.08,WHITE)
 else:
  s.cylinder((0,0,.05),.66,1.45,WHITE);s.cylinder((0,0,1.5),.73,.24,LIME)
  for i in range(28):
   a=2*math.pi*i/28;s.box((.726*math.cos(a),.726*math.sin(a),1.61),(.025,.025,.16),NAVY)
  s.box((0,-.65,.82),(.65,.025,.6),CYAN);s.box((0,-.68,.87),(.44,.02,.045),WHITE);s.box((0,-.68,.73),(.3,.02,.04),WHITE)
 return s

def render(kind,t,w=900,h=390):
 im=Image.new('RGBA',(w,h));shadow=Image.new('RGBA',(w,h));d=ImageDraw.Draw(shadow);d.ellipse((w*.20,h*.71,w*.83,h*.92),fill=(8,37,47,72));im=Image.alpha_composite(im,shadow.filter(ImageFilter.GaussianBlur(17)))
 theta=-.92+.05*math.sin(t*.9);cam=np.array([math.cos(theta),math.sin(theta),.65]);cam/=np.linalg.norm(cam);right=np.cross([0,0,1],cam);right/=np.linalg.norm(right);up=np.cross(cam,right)
 light=np.array([-.4,-.65,1]);light/=np.linalg.norm(light);scale=h/3.75;faces=[]
 for pts,c in make(kind).faces:
  p=np.array(pts);normal=np.cross(p[1]-p[0],p[2]-p[0]);normal/=max(1e-9,np.linalg.norm(normal));shade=.66+.34*max(0,np.dot(normal,light));color=tuple(round(v*shade) for v in c)+(255,)
  q=[(w/2+np.dot(v,right)*scale,h*.73-np.dot(v,up)*scale) for v in p];faces.append((p@cam,q,color))
 pixels=np.array(im);depth=np.full((h,w),-np.inf)
 for zs,q,c in faces:
  for j in range(1,len(q)-1):
   ids=[0,j,j+1];tri=np.array(q)[ids];zz=zs[ids]
   x0=max(0,int(np.floor(tri[:,0].min())));x1=min(w,int(np.ceil(tri[:,0].max()))+1);y0=max(0,int(np.floor(tri[:,1].min())));y1=min(h,int(np.ceil(tri[:,1].max()))+1)
   if x1<=x0 or y1<=y0:continue
   xx,yy=np.meshgrid(np.arange(x0,x1)+.5,np.arange(y0,y1)+.5)
   (a,b),(c1,d1),(e,f)=tri;den=(d1-f)*(a-e)+(e-c1)*(b-f)
   if abs(den)<1e-9:continue
   u=((d1-f)*(xx-e)+(e-c1)*(yy-f))/den;v=((f-b)*(xx-e)+(a-e)*(yy-f))/den;z=u*zz[0]+v*zz[1]+(1-u-v)*zz[2]
   m=(u>=0)&(v>=0)&(u+v<=1)&(z>depth[y0:y1,x0:x1])
   depth[y0:y1,x0:x1][m]=z[m];pixels[y0:y1,x0:x1][m]=c
 im=Image.fromarray(pixels)
 return im
if __name__=='__main__':
 board=Image.new('RGB',(900,390*5),'#F1F7F7')
 for i,k in enumerate(['home','bed','center','culture','cup']):board.paste(render(k,1),(0,390*i),render(k,1))
 board.save('/tmp/service-scenes-preview.jpg')
