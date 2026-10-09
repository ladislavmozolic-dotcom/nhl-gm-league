// Offline: measure a V3 flag's TARGET effect (not league averages) with vs without it.
// Run: npx tsx scripts/flag-effect.ts <blockSkill|shooterForm|overtimeStars|netFront> [seeds]
import { simulateGame } from "../lib/sim/engine";
import { loadSettings } from "../lib/sim/settings";
import { loadSimTeam } from "../lib/sim/index";
import { ENGINE_V3 } from "../lib/sim/version";
import { prisma } from "../lib/prisma";
const FL=["fatigueDeployment","coachAdaptation","checkingMatchup","qualityDAssists","faceoffPressure","reboundClearance","momentumTimeout","assistSpread","emotionalDiscipline","finishingCurve","goalieRhythm","blockSkill","goalieComposure","overtimeStars","ppPuckMovement","speedDrawsPenalties","netFront","shootoutDuel","garbageTime","shooterForm"];
const mk=(off:string[])=>Object.fromEntries(FL.map(f=>[f,!off.includes(f)]));
const corr=(a:number[],b:number[])=>{const n=a.length,ma=a.reduce((x,y)=>x+y)/n,mb=b.reduce((x,y)=>x+y)/n;let sab=0,sa=0,sb=0;for(let i=0;i<n;i++){sab+=(a[i]-ma)*(b[i]-mb);sa+=(a[i]-ma)**2;sb+=(b[i]-mb)**2;}return sab/Math.sqrt(sa*sb);};
(async()=>{
 const flag=process.argv[2]; const nSeeds=Number(process.argv[3]??10);
 const settings=await loadSettings();
 const ids=(await prisma.team.findMany({where:{league:"NHL"},select:{id:true}})).map(t=>t.id);
 const teams:any[]=[]; for(const id of ids) teams.push(await loadSimTeam(id));
 const N=teams.length;
 const blocking=new Map<number,number>(); for(const t of teams) for(const d of t.defense) blocking.set(d.id,d.blocking);
 const fSt=teams.map(t=>t.forwards.reduce((n:number,p:any)=>n+(p.attrs.st??50),0)/t.forwards.length);
 for (const on of [false,true]){
  const ex=mk(on?[]:[flag]);
  let otG=0,otBetter=0, sg=0,sgMulti=0, rebG=0;
  const blk=new Map<number,{b:number,g:number}>(); const gf=new Array(N).fill(0), gp=new Array(N).fill(0);
  for(let s=0;s<nSeeds;s++) for(let i=0;i<N;i++) for(let j=0;j<N;j++){ if(i===j) continue;
   const r:any=simulateGame(teams[i],teams[j],{settings,seed:9000000+s*100000+i*100+j,engineVersion:ENGINE_V3,experimentalV3:ex as any});
   gf[i]+=r.home.goals; gf[j]+=r.away.goals; gp[i]++; gp[j]++;
   if(r.endedIn==="OT"){ otG++; const better=teams[i].avgOV>teams[j].avgOV?teams[i].id:teams[j].id; if(r.winner===better) otBetter++; }
   for(const b of [r.home,r.away]) for(const sk of b.skaters){ sg++; if(sk.goals>=2) sgMulti++; }
   for(const b of [r.home,r.away]) for(const sk of b.skaters){ if(blocking.has(sk.id)){ const e=blk.get(sk.id)??{b:0,g:0}; e.b+=sk.blocks; e.g++; blk.set(sk.id,e);} }
  }
  const out:string[]=[`${on?"with   ":"without"} ${flag}`];
  if(flag==="overtimeStars") out.push(`OT games ${otG}, better-team win % ${(otBetter/otG*100).toFixed(1)}`);
  if(flag==="shooterForm") out.push(`multi-goal skater-games per 1000: ${(sgMulti/sg*1000).toFixed(2)}`);
  if(flag==="netFront") out.push(`corr(team F ST, goals/game) ${corr(fSt,gf.map((x,k)=>x/gp[k])).toFixed(3)}`);
  if(flag==="blockSkill"){ const k=[...blk.keys()]; out.push(`corr(D blocking, blocks/game) ${corr(k.map(x=>blocking.get(x)!),k.map(x=>blk.get(x)!.b/blk.get(x)!.g)).toFixed(3)} (n=${k.length})`); }
  console.log(out.join("  "));
 }
 process.exit(0);})();
