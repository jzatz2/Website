/**
 * Original portfolio illustrations built with wheresryan22/anatomy's MIT kit.
 * Run: node tools/build-project-covers.mjs
 * These are explanatory models, not dimensionally accurate CAD or CFD results.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as K from './anatomy/kit/iso-kit.mjs';
import * as G from './anatomy/kit/lathe.mjs';
import * as A from './anatomy/kit/audit.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const WIDTH = 720, HEIGHT = 440;
const S = (shape, tone = 'mid', inner = '') => K.solidSvg(shape, { tone, crease: 'lo', inner });
const L = (path, tone = 'lo', options = {}) => K.lineSvg(path, { tone, ...options });
const wrap = (html, attrs = '') => `<g ${attrs}>${html}</g>`;

// Every scene uses the same projection, four-tone surfaces, machined edges and
// fastener vocabulary. Coordinates are deliberately easy to tune per project.
function scene(bounds, camera = {}) {
  const P = K.fitProjection(bounds, WIDTH, HEIGHT, { pad: 48, azimuth: 53, elevation: 27, ...camera });
  const R = A.recorder(P);
  const parts = R.items;
  const put = (at, html, shapes = []) => {
    const name = `part-${parts.length}`;
    shapes.forEach((shape,index) => R.solid({...shape,name:`${name}-${index}`}));
    return R.put({at,html,shapes,name});
  };
  const slab = (x,y,z,w,d,h,tone='mid',r=1.5,detail=false,attrs='') => {
    const plan = {x,y,w,d,r};
    let inner = '';
    if (detail) {
      inner += L(K.planOutline(K.insetPlan(plan,3),z+h,P), 'faint');
      for (const [sx,sy] of K.corners(plan,5)) {
        inner += L(K.ring(sx,sy,1.35,z+h,P,16), 'mid');
        inner += K.dotsSvg([K.iso([sx,sy,z+h],P)],{size:.5,tone:'hi'});
      }
    }
    put([x+w/2,y+d/2,z+h/2],wrap(S(K.slabOf(plan,z,h,P,4,.6),tone,inner),attrs),[A.slab(plan,z,h,{},4)]);
  };
  const cyl = (x,y,z,r,h,tone='mid',attrs='',inner='') => put([x,y,z+h/2],wrap(S(K.cylinder(x,y,r,z,h,P,40,.4),tone,inner),attrs),[A.cylinder(x,y,r,z,h)]);
  const disc = (origin,axis,r,length,tone='mid',attrs='',inner='') => {
    const F = G.frameAlong(origin,axis);
    put(G.add3(origin,G.mul3(axis,length/2)),wrap(S(G.disc(0,length,r,F,P),tone,inner),attrs),[A.disc(F,0,length,r)]);
  };
  const rod = (a,b,r,tone='mid',attrs='') => {
    const delta=G.sub3(b,a); disc(a,G.unit3(delta),r,G.len3(delta),tone,attrs);
  };
  const ball = (at,r,tone='hi',attrs='') => put(at,wrap(S(G.sphereOf(at,r,P),tone),attrs),[A.ball(at,r)]);
  const base = (x,y,w,d) => {
    const plan={x,y,w,d,r:5};
    put([0,0,-1000],`<path class="iso-halo" d="${K.haloOf(plan,0,9,P)}"/>`);
    for(const [fx,fy] of K.corners(plan,13)) cyl(fx,fy,0,5,4,'lo');
    slab(x,y,4,w,d,7,'lo',5,true);
  };
  const finish = (name,label,extra='') => {
    const result = A.settle(R,P);
    // Optional diagnostics only: these portfolio schematics have intentional
    // mechanical overlaps and are not a collision-validated CAD assembly.
    if (process.argv.includes('--depth-report')) {
      const depth=A.depthOrder(R.items,P,{overlaps:result.overlaps,solved:result.solved});
      console.log(`${name}: ${R.solids.length} recorded solids; depth conflicts ${depth.problems.length}, missing ${depth.missing.length}`);
    }
    const body=parts.sort((a,b)=>a.key-b.key).map(p=>p.html).join('')+extra;
    return K.figureSvg({width:WIDTH,height:HEIGHT,label,body,className:`cover-drawing cover-${name}`})
      .replace('<svg ',`<svg data-cover="${name}" `);
  };
  return {P,parts,put,slab,cyl,disc,rod,ball,base,finish};
}

function fermi() {
  // Parts: four feet, base, hall walls/rails, target, two focusing horns and
  // mounts, decay pipe segments/rings/saddles, absorber, three monitor planes,
  // shielding blocks, service flange, eight bolts, arm base/links/joints/tool.
  const s=scene(K.boxCorners({x:-260,y:-55,w:535,d:115,r:0},0,115),{azimuth:68,elevation:25,pad:30});
  const {P,slab,cyl,disc,rod,ball,base,put}=s;
  base(-260,-55,535,115);
  slab(-242,-43,11,160,6,54,'lo',1,true);
  slab(-242,-43,11,6,80,24,'lo');
  slab(-242,34,11,160,6,12,'lo');
  for(const y of [-24,21]) slab(-235,y,11,152,3,4,'mid',.4);
  // Proton line and graphite target in the open target hall.
  disc([-258,0,43],[1,0,0],3,48,'hi');
  slab(-214,-3,40,26,6,6,'hi',.6,false,'class="accent-solid"');
  for(const x of [-178,-125]) {
    slab(x-7,-15,11,14,30,13,'mid',1,true);
    const F=G.frameAlong([x-16,0,43],[1,0,0]);
    const profile=[[0,12],[7,10],[16,4],[27,7],[34,12]];
    put([x,0,43],S(G.solidOf(profile,F,P),'hi'),[A.solid(F,profile)]);
    disc([x-18,0,43],[1,0,0],14,2,'mid');
    disc([x+18,0,43],[1,0,0],14,2,'mid');
  }
  // Compressed decay pipe: repeat complete segments so overlaps are sortable.
  for(let x=-79;x<61;x+=20) {
    disc([x,0,43],[1,0,0],15,18,'mid');
    disc([x+18,0,43],[1,0,0],16,2,'hi');
    slab(x+6,-12,11,6,24,17,'lo');
  }
  slab(65,-26,11,24,52,57,'mid',1,true);
  slab(89,-19,11,3,38,45,'hi');
  for(const x of [104,132,160]) {
    slab(x,-30,11,7,60,64,'lo',1);
    slab(x+8,-23,11,2,46,58,'hi',.3);
    for(let z=20;z<65;z+=9) {
      put([x+10,0,z],L(K.segment([x+10,-22,z],[x+10,22,z],P),'lo'));
    }
  }
  // A schematic maintenance station at the downstream end, intentionally enlarged.
  slab(179,-16,11,8,32,27,'mid');
  const F=G.frameAlong([181,0,52],[1,0,0]);
  disc([178,0,52],[1,0,0],17,8,'hi');
  put([186,0,52],L(G.circleOf(F,5,12,P),'mid'));
  for(let i=0;i<8;i++) {
    const a=i*Math.PI/4;
    disc([186,13*Math.cos(a),52+13*Math.sin(a)],[1,0,0],1.7,2,'hi');
  }
  slab(216,5,11,36,34,9,'mid',3,true);
  cyl(234,22,20,12,9,'hi');
  rod([234,22,29],[237,22,57],8,'hi');
  ball([237,22,57],9,'hi');
  rod([237,22,57],[218,16,92],6.5,'hi');
  ball([218,16,92],8,'hi');
  rod([218,16,92],[197,8,72],5.5,'hi');
  ball([197,8,72],6,'hi');
  rod([197,8,72],[196,0,65],4,'hi');
  rod([196,0,65],[188,0,65],2.3,'hi','class="accent-solid"');
  // The tool turns about its real X axis, projected as a 2D matrix.
  const c=K.iso([188,0,65],P), u=K.axisVector(P,[0,1,0]), v=K.axisVector(P,[0,0,1]);
  put([189,0,65],`<g transform="matrix(${u[0]} ${u[1]} ${v[0]} ${v[1]} ${c[0]} ${c[1]})"><g data-motion="spindle"><path d="M-2.5 0H2.5M0 -2.5V2.5" fill="none" stroke="#ad7631" stroke-width="1"/></g></g>`);
  // Beam is a symbolic path, not an extra physical tube.
  const beam=L(K.segment([-257,-1,43],[176,-1,43],P),'blue',{flow:true});
  return s.finish('fermi','Isometric NuMI beamline: target hall with two horns, decay pipe, absorber, monitor planes and an enlarged robot unscrewing an end flange.',wrap(beam,'class="beam-path"'));
}

function abbott() {
  // Large reservoir below a narrow porous strip, ending in a smaller receiver.
  // Mount, feet, backing, gasket, 8 clamps, porous cells, reservoirs, electrodes,
  // circuit board, antenna traces and fasteners: 70+ visible functional details.
  const s=scene(K.boxCorners({x:-105,y:-48,w:210,d:96,r:0},0,210),{azimuth:31,elevation:23});
  const {P,slab,cyl,base,put}=s;
  base(-105,-48,210,96);
  slab(-78,-12,11,156,14,190,'lo',4,true);
  slab(-72,3,23,144,5,170,'hi',3);
  // The channel lies in the X/Z plane; local SVG y increases downward.
  const o=K.iso([-65,10,193],P), ux=K.axisVector(P,[1,0,0]), uz=K.axisVector(P,[0,0,-1]);
  const matrix=`matrix(${ux[0]} ${ux[1]} ${uz[0]} ${uz[1]} ${o[0]} ${o[1]})`;
  const channel='M44 0H86V32H72V104H130V170H0V104H58V32H44Z';
  let pores='';
  for(let y=36;y<103;y+=5) for(let x=61;x<72;x+=5) pores+=`<circle cx="${x}" cy="${y}" r=".8" fill="#4a7c79" opacity=".45"/>`;
  let ticks='';
  for(let y=40;y<103;y+=8) ticks+=`<path d="M75 ${y}h5" stroke="#8a9899" stroke-width=".5"/>`;
  const channelFace=`<g transform="${matrix}">
    <defs><clipPath id="abbott-channel"><path d="${channel}"/></clipPath></defs>
    <path d="${channel}" fill="#e7eeeb" stroke="#6d8280" stroke-width="1.4"/>
    <path d="M58 32H72V104H58Z" fill="#c6d8cd"/>
    <g clip-path="url(#abbott-channel)">
      <rect data-motion="electrolyte" x="0" y="110" width="130" height="60" fill="#69a99e" opacity=".84"/>
      <path data-motion="meniscus" d="M0 110H130" stroke="#27766c" stroke-width="1.4"/>
    </g>${pores}${ticks}
    <path d="M46 3H84V29H46Z" fill="none" stroke="#acbab7" stroke-width=".7"/>
    <path d="M3 107H127V167H3Z" fill="none" stroke="#acbab7" stroke-width=".7"/>
    <path d="M49 8H54V24H49ZM76 8H81V24H76Z" fill="#b79858"/>
    <path d="M51 8V-3M78 8V-3" stroke="#a08650" stroke-width="1.3"/>
  </g>`;
  for(const x of [-76,70]) for(const z of [32,78,128,181]) {
    slab(x,4,z,6,13,9,'mid',.6);
    cyl(x+3,10,z+9,1.2,1,'hi');
  }
  slab(-38,-25,201,76,25,3,'mid',2,true);
  for(let i=0;i<5;i++) {
    const plan={x:-33+i*2.5,y:-22+i*1.3,w:66-i*5,d:18-i*2.6,r:2};
    put([0,-13,204.1],L(K.planOutline(plan,204.1,P),'mid'));
  }
  slab(-7,-16,204,14,8,2,'hi',.6);
  for(const x of [-54,46]) slab(x,12,11,8,24,15,'mid',1,true);
  // This planar channel sits on the foremost plate face, beyond the clamp edges.
  return s.finish('abbott','Simplified electrolyte sensor: a large lower reservoir feeds liquid upward through a narrow porous membrane to a smaller sensing chamber.',channelFace);
}

function alloy() {
  // Conventional FCC unit cell: 8 corner atoms + 6 face-centred atoms.
  // 4 effective atoms per cell. Connecting rods are a visualization aid.
  const s=scene(K.boxCorners({x:-105,y:-105,w:210,d:210,r:0},0,190),{azimuth:42,elevation:25});
  const {P,slab,cyl,rod,ball,base,put}=s;
  base(-105,-105,210,210);
  slab(-87,-87,11,174,174,5,'mid',3,true);
  const a=62,z0=35,z1=159;
  const atoms=[];
  for(const x of [-a,a])for(const y of [-a,a])for(const z of [z0,z1])atoms.push([x,y,z]);
  const faces=[[0,0,z0],[0,0,z1],[0,-a,97],[0,a,97],[-a,0,97],[a,0,97]];
  const segments=[];
  for(let i=0;i<atoms.length;i++)for(let j=i+1;j<atoms.length;j++) {
    if(atoms[i].filter((v,n)=>v!==atoms[j][n]).length===1) segments.push([atoms[i],atoms[j]]);
  }
  for(const f of faces)for(const c of atoms)if(Math.abs(G.len3(G.sub3(c,f))-Math.sqrt(2)*a)<.1)segments.push([f,c]);
  // Stop every bond on the spherical surface, keeping the faces solid.
  for(const [a,b] of segments) {
    const dir=G.unit3(G.sub3(b,a));
    rod(G.add3(a,G.mul3(dir,11)),G.sub3(b,G.mul3(dir,11)),1.1,'lo');
  }
  for(const at of atoms)ball(at,11,'hi');
  for(const at of faces)ball(at,13,'hi','class="accent-solid"');
  for(const x of [-a,a])for(const y of [-a,a])cyl(x,y,16,4,8,'mid');
  const plan={x:-35,y:82,w:70,d:13,r:1};
  slab(plan.x,plan.y,16,plan.w,plan.d,1,'lo',1);
  put([0,88,17.1],K.faceTextSvg(K.topMatrix([-27,91],17.1,P),'FCC / UNIT CELL',{size:4,tone:'hi'}));
  return s.finish('alloy','Face-centred cubic unit cell with eight corner atoms and six face-centred atoms, on a machined specimen plate.');
}

function engine() {
  // SolidWorks-inspired cutaway: lower bed, rear wall, end webs, two bores,
  // pistons and ring grooves, camshaft, offset cams, followers, wrist pins,
  // crank handle, fasteners and a ribbed housing. 180-degree piston offset.
  const s=scene(K.boxCorners({x:-115,y:-65,w:245,d:130,r:0},0,205),{azimuth:52,elevation:26});
  const {P,slab,cyl,disc,rod,put,base}=s;
  base(-115,-65,245,130);
  slab(-99,-48,11,194,96,12,'mid',4,true);
  slab(-99,-48,23,194,9,158,'mid',2);
  for(const x of [-99,-4,86])slab(x,-39,23,9,79,158,'mid',1);
  for(const y of [-48,35])slab(-99,y,174,194,8,12,'hi',1,true);
  // Shaft is split around its cam lobes; all mounted to the end webs.
  for(const [x,len] of [[-99,28],[-51,74],[43,65]])disc([x,0,54],[1,0,0],5,len,'hi');
  for(const x of [-70,24]) {
    disc([x,0,54],[1,0,0],21,18,'mid');
    disc([x+18,0,54],[1,0,0],7,2,'hi');
  }
  const vz=K.axisVector(P,[0,0,1]);
  for(const [i,x] of [-51,43].entries()) {
    // One continuous semicircular bore wall, opened along the front section
    // plane. The smooth inner surface replaces the old row of separate posts.
    const bore=[];
    for(let n=0;n<=64;n++) {
      const a=Math.PI+n*Math.PI/64;
      bore.push([x+31*Math.cos(a),31*Math.sin(a)]);
    }
    for(let n=64;n>=0;n--) {
      const a=Math.PI+n*Math.PI/64;
      bore.push([x+26*Math.cos(a),26*Math.sin(a)]);
    }
    put([x,-17,136],S(K.extrude(bore,98,76,P,{convex:false}),'mid'),[A.extruded(bore,98,76)]);
    const inner=[];
    inner.push(S(K.cylinder(x,0,24,125,39,P,64,.6),'hi'));
    for(const z of [154,158,162])inner.push(L(K.sideArc(x,0,24,z,P,48),'mid'));
    inner.push(S(G.disc(0,7,5,G.frameAlong([x,19,137],[0,1,0]),P),'mid'));
    inner.push(S(K.cylinder(x,0,5,78,47,P,32),'hi'));
    inner.push(S(K.cylinder(x,0,10,72,6,P,32),'mid'));
    for(const [dx,dy] of [[-11,-7],[11,-7],[0,11]]) {
      inner.push(S(K.cylinder(x+dx,dy,2.5,164,3,P,20),'mid'));
      inner.push(L(K.ring(x+dx,dy,1,167,P),'hi'));
    }
    put([x,4,135],wrap(inner.join(''),`data-motion="piston" data-phase="${i}" data-vx="${vz[0]}" data-vy="${vz[1]}" class="accent-solid"`),[
      A.cylinder(x,0,24,125,39), A.disc(G.frameAlong([x,19,137],[0,1,0]),0,7,5), A.cylinder(x,0,5,78,47), A.cylinder(x,0,10,72,6),
      ...[[-11,-7],[11,-7],[0,11]].map(([dx,dy])=>A.cylinder(x+dx,dy,2.5,164,3))
    ]);
  }
  // End crank with raised handle and concentric machined hub.
  const F=G.frameAlong([102,0,54],[1,0,0]);
  disc([102,0,54],[1,0,0],27,6,'mid');
  put([108,0,54],L(G.circleOf(F,6,21,P),'lo'));
  disc([108,0,54],[1,0,0],7,4,'hi');
  rod([112,0,54],[112,19,72],3,'hi');
  disc([112,19,72],[1,0,0],4.5,16,'hi');
  for(const x of [-91,-4,87])for(const y of [-42,38])cyl(x+4,y,186,2.4,2,'hi');
  for(let z=32;z<154;z+=14)put([95,0,z],L(K.segment([95,-38,z],[95,34,z],P),'faint'));
  return s.finish('engine','Cutaway inline two-cylinder engine fidget toy, with offset cams, reciprocating pistons, a hand crank and detailed housing.');
}

function robot() {
  // Based on the supplied assembled prototype: red box chassis, two large
  // drive wheels, rear casters, twin upright toothed racks and ultrasonic eyes.
  const s=scene(K.boxCorners({x:-130,y:-100,w:270,d:225,r:0},0,217),{azimuth:52,elevation:25,pad:40});
  s.base(-130,-100,270,225);
  s.slab(-125,-95,11,70,205,25,'lo',2);
  s.slab(-125,-95,36,43,205,28,'lo',2);
  s.slab(-125,-95,64,18,205,28,'lo',2);
  // Turn only the robot 180 degrees about its chassis centre. The stair
  // assembly stays fixed, so the front sensors and drive wheels face it.
  const turn = ([x,y,z]) => [26-x,-y,z];
  const P = {...s.P, azimuth:s.P.azimuth+180, origin:K.iso([26,0,0],s.P)};
  const slab = (x,y,z,w,d,h,...rest) => s.slab(26-x-w,-y-d,z,w,d,h,...rest);
  const disc = (at,axis,...rest) => s.disc(turn(at),[-axis[0],-axis[1],axis[2]],...rest);
  const rod = (a,b,...rest) => s.rod(turn(a),turn(b),...rest);
  const put = (at,html) => s.put(turn(at),html);
  // Lower support plate and enclosure, now facing the stairs at negative X.
  slab(-55,-48,35,136,96,9,'mid',3,true);
  slab(-55,-48,44,136,6,41,'mid',1,false,'class="accent-solid"');
  slab(-55,42,44,136,6,41,'mid',1,false,'class="accent-solid"');
  slab(-55,-42,44,6,84,41,'mid',1,false,'class="accent-solid"');
  slab(75,-42,44,6,84,41,'mid',1,false,'class="accent-solid"');
  slab(-54,-47,85,134,94,4,'hi',2,true,'class="accent-solid"');
  // Large rubber drive wheels with grooved treads, hubs and axle caps.
  for(const y of [-62,48]) {
    disc([42,y,39],[0,1,0],28,14,'hi','class="rubber-solid"');
    const outward=y<0?-1:1, outerY=y<0?y:y+14;
    const F=G.frameAlong([42,outerY,39],[0,outward,0]);
    disc([42,outerY,39],[0,outward,0],19,2,'mid');
    disc([42,outerY+outward*2,39],[0,outward,0],6,3,'hi');
    put([42,outerY+outward*2,39],L(G.spokesOf(F,2,7,17,8,P),'mid'));
    for(let a=0;a<Math.PI*2;a+=Math.PI/12) {
      const x=42+28.2*Math.cos(a),z=39+28.2*Math.sin(a);
      put([x,y+7,z],L(K.segment([x,y+1,z],[x,y+13,z],P),'lo'));
    }
  }
  for(const y of [-34,34]) {
    slab(-49,y-4,24,10,8,11,'mid');
    disc([-44,y-4,21],[0,1,0],10,8,'mid','class="rubber-solid"');
    disc([-44,y+4,21],[0,1,0],3,2,'hi');
  }
  // Parallel lift columns with individually drawn rack teeth and crosshead.
  for(const y of [-30,24]) {
    slab(-23,y,89,12,6,113,'mid',.8,false,'class="accent-solid"');
    slab(-10,y,91,3,6,107,'hi',.3);
    for(let z=93;z<197;z+=5)slab(-7,y,z,3,6,2,'hi',.2);
    slab(-29,y-2,91,6,10,20,'mid',.5,true);
  }
  slab(-26,-34,202,20,68,6,'hi',1,true,'class="accent-solid"');
  slab(-26,-34,118,22,68,10,'mid',1,true);
  rod([-15,-24,129],[-15,-24,200],2,'hi');
  rod([-15,24,129],[-15,24,200],2,'hi');
  // Front ultrasonic board, transducers, mounting screws and status LED.
  slab(81,-22,60,3,44,18,'mid',.7);
  for(const y of [-12,12]) {
    disc([84,y,69],[1,0,0],6.5,5,'hi');
    disc([89,y,69],[1,0,0],4.8,.7,'lo','class="rubber-solid"');
  }
  disc([84,0,62],[1,0,0],1.4,1,'hi','class="accent-solid"');
  slab(28,-14,89,26,28,3,'lo',1,true);
  for(let x=32;x<52;x+=4)slab(x,-10,92,1,20,.6,'mid',.1);
  return s.finish('robot','Autonomous stair-climbing robot turned toward three stairs, with its front ultrasonic sensors and large drive wheels facing the steps, rear casters and twin toothed lift racks.');
}

const projects=[
  {id:'fermi',number:'01',category:'FERMILAB · ROBOTICS',title:'Fermilab Computer Vision Robot Arm',note:'NuMI beamline · schematic, not to scale',build:fermi},
  {id:'abbott',number:'02',category:'ABBOTT · FLUID DYNAMICS',title:'Medical Electrolyte Triggered RFID Sensor',note:'Electrolyte transport · illustrative cycle',build:abbott},
  {id:'alloy',number:'03',category:'MATERIALS · MACHINE LEARNING',title:'Supervised Learning on Alloy Hardness',note:'FCC unit cell · 8 corners + 6 face centres',build:alloy},
  {id:'engine',number:'04',category:'MECHANICAL DESIGN · CAD',title:'2-Cylinder Inline Engine Fidget Toy',note:'Cutaway assembly · opposing pistons',build:engine},
  {id:'robot',number:'05',category:'ROBOTICS · MECHATRONICS',title:'Autonomous Stair-Climbing Robot',note:'Stair climber · rack-and-pinion lift',build:robot},
];

mkdirSync(`${ROOT}assets/covers`,{recursive:true});
let html=readFileSync(`${ROOT}index.html`,'utf8');
for(const p of projects) {
  const svg=p.build();
  writeFileSync(`${ROOT}assets/covers/${p.id}.svg`,svg.replace('</svg>',`<style>${K.ISO_CSS}</style></svg>`).replace('class="iso-svg','data-theme="light" class="iso iso-svg'));
  const cover=`<!-- cover:${p.id}:start -->
                <button class="project-cover" id="cover-${p.id}" type="button" aria-expanded="false" aria-controls="details-${p.id}" aria-labelledby="title-${p.id}">
                    <span class="project-cover-copy">
                        <span class="project-eyebrow"><span>${p.number}</span>${p.category}</span>
                        <span class="project-card-title" id="title-${p.id}">${p.title}</span>
                        <span class="project-open-label"><span data-open-label>Explore project</span><span class="project-open-icon" aria-hidden="true">↗</span></span>
                    </span>
                    <span class="project-art iso" data-theme="light">
                        ${svg}
                    </span>
                </button>
                <!-- cover:${p.id}:end -->`;
  const marker=new RegExp(`<!-- cover:${p.id}:start -->[\\s\\S]*?<!-- cover:${p.id}:end -->`);
  if(marker.test(html))html=html.replace(marker,()=>cover);
  else {
    html=html.replace(/<div class="project-item">\s*<div class="project-header">[\s\S]*?<\/div>\s*<div class="project-content">/,
      ()=>`<div class="project-item project-${p.id}" id="project-${p.id}">\n                ${cover}\n                <div class="project-content" id="details-${p.id}" role="region" aria-label="${p.title}" hidden>\n                    <div class="project-detail-heading"><h2>${p.title}</h2><button type="button" class="project-close" aria-label="Close ${p.title}">Close project <span aria-hidden="true">×</span></button></div>`);
  }
  // Keep the expanded panel's title and accessibility label in sync.
  html=html.replace(new RegExp(`(<div class="project-content" id="details-${p.id}"[^>]*aria-label=")[^"]*`),`$1${p.title}`);
  html=html.replace(new RegExp(`(<div class="project-content" id="details-${p.id}"[\\s\\S]*?<div class="project-detail-heading"><h2>)[^<]*(<\\/h2><button[^>]*aria-label=")[^"]*`),`$1${p.title}$2Close ${p.title}`);
}
writeFileSync(`${ROOT}index.html`,html);
writeFileSync(`${ROOT}assets/covers/anatomy.css`,K.ISO_CSS);
mkdirSync(`${ROOT}preview`,{recursive:true});
const section=html.match(/<section id="projects">[\s\S]*?<\/section>/)[0].replace(/<img[^>]+class="icon arrow"[^>]*\/>/g,'').replace(/[ \t]+$/gm,'');
writeFileSync(`${ROOT}preview/projects.html`,`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="../"><title>Joshua Zatz — Project preview</title><link rel="stylesheet" href="style.css"><link rel="stylesheet" href="mediaqueries.css"><link rel="stylesheet" href="assets/covers/anatomy.css"><link rel="stylesheet" href="projects.css"></head><body>${section}<script src="script.js"></script><script src="projects.js"></script></body></html>`);
console.log('Built and embedded five Anatomy project covers.');
