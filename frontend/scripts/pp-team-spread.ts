// Offline: per-team PP% spread with vs without the V3 ppPuckMovement flag. Run: npx tsx scripts/pp-team-spread.ts
import { simulateGame } from "../lib/sim/engine";
import { loadSettings } from "../lib/sim/settings";
import { loadSimTeam } from "../lib/sim/index";
import { ENGINE_V3 } from "../lib/sim/version";
import { prisma } from "../lib/prisma";
const FL=["fatigueDeployment","coachAdaptation","checkingMatchup","qualityDAssists","faceoffPressure","reboundClearance","momentumTimeout","assistSpread","emotionalDiscipline","finishingCurve","goalieRhythm","blockSkill","goalieComposure","overtimeStars","ppPuckMovement"];
const mk=(on:string[])=>Object.fromEntries(FL.map(f=>[f,on.includes(f)]));
const corr=(a:number[],b:number[])=>{const n=a.length,ma=a.reduce((x,y)=>x+y)/n,mb=b.reduce((x,y)=>x+y)/n;let sab=0,sa=0,sb=0;for(let i=0;i<n;i++){sab+=(a[i]-ma)*(b[i]-mb);sa+=(a[i]-ma)**2;sb+=(b[i]-mb)**2;}return sab/Math.sqrt(sa*sb);};
(async()=>{
 const settings=await loadSettings();
 const ids=(await prisma.team.findMany({where:{league:"NHL"},select:{id:true}})).map(t=>t.id);
 const teams:any[]=[]; for(const id of ids) teams.push(await loadSimTeam(id));
 const N=teams.length;
 // team PP skill proxy: mean PA of top 5 skaters by offense, minus nothing
 const skill=teams.map(t=>{const sk=[...t.forwards,...t.defense].sort((a,b)=>b.offense-a.offense).slice(0,5);return sk.reduce((n:number,s:any)=>n+(s.attrs.pa??50),0)/5;});
 const seeds=Array.from({length:12},(_,i)=>4000000+i*100000);
 for (const [name,ex] of [["without PP flag",mk(FL.filter(f=>f!=="ppPuckMovement"))],["with PP flag",mk(FL)]] as const){
  const g=new Array(N).fill(0), o=new Array(N).fill(0);
  for(const sd of seeds) for(let i=0;i<N;i++) for(let j=0;j<N;j++){ if(i===j) continue;
   const r=simulateGame(teams[i],teams[j],{settings,seed:sd+i*100+j,engineVersion:ENGINE_V3,experimentalV3:ex as any});
   g[i]+=r.home.ppGoals; o[i]+=r.home.ppOpp; g[j]+=r.away.ppGoals; o[j]+=r.away.ppOpp; }
  const pp=g.map((x,i)=>x/Math.max(1,o[i])*100); const m=pp.reduce((a,b)=>a+b)/N; const sd=Math.sqrt(pp.reduce((a,b)=>a+(b-m)**2,0)/(N-1));
  const noise=Math.sqrt(m/100*(1-m/100)/(o.reduce((a,b)=>a+b)/N))*100;
  console.log(name.padEnd(16),"team PP% mean",m.toFixed(2),"sd",sd.toFixed(2),"(binomial noise ~",noise.toFixed(2),") corr(PA skill, PP%)",corr(skill,pp).toFixed(3),"range",Math.min(...pp).toFixed(1),"-",Math.max(...pp).toFixed(1));
 }
 process.exit(0);})();
