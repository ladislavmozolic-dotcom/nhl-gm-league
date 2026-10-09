// Offline: shootout conversion and PS dependence with vs without the V3 shootoutDuel flag. Run: npx tsx scripts/so-duel.ts
import { simulateGame } from "../lib/sim/engine";
import { loadSettings } from "../lib/sim/settings";
import { loadSimTeam } from "../lib/sim/index";
import { ENGINE_V3 } from "../lib/sim/version";
import { prisma } from "../lib/prisma";
const FL=["fatigueDeployment","coachAdaptation","checkingMatchup","qualityDAssists","faceoffPressure","reboundClearance","momentumTimeout","assistSpread","emotionalDiscipline","finishingCurve","goalieRhythm","blockSkill","goalieComposure","overtimeStars","ppPuckMovement","speedDrawsPenalties","netFront","shootoutDuel"];
const mk=(on:string[])=>Object.fromEntries(FL.map(f=>[f,on.includes(f)]));
const corr=(a:number[],b:number[])=>{const n=a.length,ma=a.reduce((x,y)=>x+y)/n,mb=b.reduce((x,y)=>x+y)/n;let sab=0,sa=0,sb=0;for(let i=0;i<n;i++){sab+=(a[i]-ma)*(b[i]-mb);sa+=(a[i]-ma)**2;sb+=(b[i]-mb)**2;}return sab/Math.sqrt(sa*sb);};
(async()=>{
 const settings=await loadSettings();
 const ids=(await prisma.team.findMany({where:{league:"NHL"},select:{id:true}})).map(t=>t.id);
 const teams:any[]=[]; for(const id of ids) teams.push(await loadSimTeam(id));
 const N=teams.length, gps=teams.map(t=>t.goalie.attrs.ps as number);
 for (const [name,ex] of [["without flag",mk(FL.filter(f=>f!=="shootoutDuel"))],["with flag",mk(FL)]] as const){
  let att=0,goals=0; const gAtt=new Array(N).fill(0), gGoal=new Array(N).fill(0);
  for(let s=0;s<14;s++) for(let i=0;i<N;i++) for(let j=0;j<N;j++){ if(i===j) continue;
   const r:any=simulateGame(teams[i],teams[j],{settings,seed:6000000+s*100000+i*100+j,engineVersion:ENGINE_V3,experimentalV3:ex as any});
   for(const a of r.shootout){ att++; const sc=a.result==="goal"; if(sc) goals++; const defIdx=a.teamId===teams[i].id?j:i; gAtt[defIdx]++; if(sc) gGoal[defIdx]++; } }
  const gsv=gGoal.map((x,k)=>gAtt[k]?x/gAtt[k]*100:0);
  console.log(name.padEnd(13),"SO attempts",att,"conv %",(goals/att*100).toFixed(2),"corr(goalie PS, goals allowed %)",corr(gps,gsv).toFixed(3));
 }
 process.exit(0);})();
