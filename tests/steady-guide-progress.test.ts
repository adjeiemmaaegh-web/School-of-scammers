import {describe,it,expect} from 'vitest';
import { GUIDE_PROGRESS_KEY,emptyGuideProgress,parseGuideProgress } from '../src/steady-guide/guide-progress';
import { GUIDE_TOPICS } from '../src/steady-guide/guide-data';
const ids=GUIDE_TOPICS.map(t=>t.id);
describe('Steady Guide isolated progress',()=>{
 it('does not use any simulator or assessment storage key',()=>{
  expect(GUIDE_PROGRESS_KEY).toBe('efo-steady-guide-progress-v1');
  expect(GUIDE_PROGRESS_KEY).not.toContain('sandbox-project');
  expect(GUIDE_PROGRESS_KEY).not.toContain('scenario');
 });
 it('safely starts over on empty, corrupt, unsupported and oversized data',()=>{
  expect(parseGuideProgress(null,ids)).toEqual(emptyGuideProgress());
  expect(parseGuideProgress('{',ids)).toEqual(emptyGuideProgress());
  expect(parseGuideProgress(JSON.stringify({version:9,completed:ids}),ids)).toEqual(emptyGuideProgress());
  expect(parseGuideProgress('x'.repeat(13000),ids)).toEqual(emptyGuideProgress());
  expect(parseGuideProgress(JSON.stringify({version:1,completed:'welcome'}),ids)).toEqual(emptyGuideProgress());
 });
 it('filters bogus IDs and duplicates without altering a project',()=>{
  const result=parseGuideProgress(JSON.stringify({version:1,completed:['welcome','welcome','not-an-id',17,'first-lamp'],lastTopic:'first-lamp'}),ids);
  expect(result).toEqual({completed:['welcome','first-lamp'],lastTopic:'first-lamp'});
 });
 it('drops unknown last topic, malformed objects and prototype-shaped payloads',()=>{
  expect(parseGuideProgress('[]',ids)).toEqual(emptyGuideProgress());
  expect(parseGuideProgress(JSON.stringify({version:1,completed:[],lastTopic:'not-a-topic'}),ids).lastTopic).toBeNull();
  expect(parseGuideProgress(JSON.stringify({version:1,completed:['__proto__','constructor'],lastTopic:'constructor'}),ids)).toEqual(emptyGuideProgress());
 });
});
