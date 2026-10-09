// Offline: do faster teams draw more PP opportunities with the V3 speedDrawsPenalties flag?
// Run: npx tsx scripts/pp-opp-speed.ts
import { simulateGame } from "../lib/sim/engine";
import { loadSettings } from "../lib/sim/settings";
import { loadSimTeam } from "../lib/sim/index";
import { ENGINE_V3 } from "../lib/sim/version";
import { prisma } from "../lib/prisma";
const FL=["fatigueDeployment","coachAdaptation","checkingMatchup","qualityDAssists","faceoffPressure","reboundClearance","momentumTimeout","assistSpread","emotionalDiscipline","finishingCurve","goalieRhythm","blockSkill","goalieComposure","overtimeStars","ppPuckMovement","speedDrawsPenalties"];
const mk=(on:string[])=>Object.fromEntries(FL.map(f=>[f,on.includes(f)]));
const corr=(a:number[],b:number[])=>{const n=a.length,ma=a.reduce((x,y)=>x+y)/n,mb=b.reduce((x,y)=>x+y)/n;let sab=0,sa=0,sb=0;for(let i=0;i<n;i++){sab+=(a[i]-ma)*(b[i]-mb);sa+=(a[i]-ma)**2;sb+=(b[i]-mb)**2;}return {r:sab/Math.sqrt(sa*sb),slope:sab/sa};};
(async()=>{
 const settings=await loadSettings();
 const ids=(await prisma.team.findMany({where:{league:"NHL"},select:{id:true}})).map(t=>t.id);
 const teams:any[]=[]; for(const id of ids) teams.push(await loadSimTeam(id));
 const N=teams.length;
 const sk=teams.map(t=>{const all=[...t.forwards,...t.defense];let s=0,w=0;for(const p of all){s+=(p.attrs.sk??50)*p.iceTime;w+=p.iceTime;}return s/w;});
 const sd=Math.sqrt(sk.reduce((a,b)=>a+(b-sk.reduce((x,y)=>x+y)/N)**2,0)/(N-1));
 console.log("team SK sd",sd.toFixed(2),"range",Math.min(...sk).toFixed(1),"-",Math.max(...sk).toFixed(1));
 const seeds=Array.from({length:12},(_,i)=>5000000+i*100000);
 for (const [name,ex] of [["without flag",mk(FL.filter(f=>f!=="speedDrawsPenalties"))],["with flag",mk(FL)]] as const){
  const opp=new Array(N).fill(0), gp=new Array(N).fill(0);
  for(const s of seeds) for(let i=0;i<N;i++) for(let j=0;j<N;j++){ if(i===j) continue;
   const r=simulateGame(teams[i],teams[j],{settings,seed:s+i*100+j,engineVersion:ENGINE_V3,experimentalV3:ex as any});
   opp[i]+=r.home.ppOpp; opp[j]+=r.away.ppOpp; gp[i]++; gp[j]++; }
  const perGame=opp.map((x,i)=>x/gp[i]); const c=corr(sk,perGame);
  console.log(name.padEnd(13),"PP opps/game mean",(perGame.reduce((a,b)=>a+b)/N).toFixed(3),"corr(SK,opps)",c.r.toFixed(3),"slope per SK pt",c.slope.toFixed(4));
 }
 process.exit(0);})();
