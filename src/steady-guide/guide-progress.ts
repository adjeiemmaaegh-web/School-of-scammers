/** Independent local progress, deliberately separate from all project and assessment keys. */
export const GUIDE_PROGRESS_KEY='efo-steady-guide-progress-v1';
export type GuideProgress={completed:string[];lastTopic:string|null};
export const emptyGuideProgress=():GuideProgress=>({completed:[],lastTopic:null});
export function parseGuideProgress(text:string|null,validIds:readonly string[]):GuideProgress{
 if(!text||text.length>12000)return emptyGuideProgress();
 try{
  const x:unknown=JSON.parse(text);if(!x||typeof x!=='object')return emptyGuideProgress();
  const data=x as {completed?:unknown;lastTopic?:unknown;version?:unknown};
  if(data.version!==1||!Array.isArray(data.completed))return emptyGuideProgress();
  const ids=new Set(validIds);
  const completed=[...new Set(data.completed.filter((v:unknown):v is string=>typeof v==='string'&&ids.has(v)))].slice(0,validIds.length);
  return {completed,lastTopic:typeof data.lastTopic==='string'&&ids.has(data.lastTopic)?data.lastTopic:null};
 }catch{return emptyGuideProgress();}
}
export function readGuideProgress(validIds:readonly string[]):GuideProgress{
 try{return parseGuideProgress(window.localStorage.getItem(GUIDE_PROGRESS_KEY),validIds);}catch{return emptyGuideProgress();}
}
export function saveGuideProgress(data:GuideProgress):boolean{
 try{window.localStorage.setItem(GUIDE_PROGRESS_KEY,JSON.stringify({version:1,...data}));return true;}catch{return false;}
}
