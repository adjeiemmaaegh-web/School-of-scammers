import {describe,it,expect} from 'vitest';
import {createHistory,commitDocument,undoDocument,redoDocument} from '../src/engineering/document-history';
import {conveyorStarter,validateLadder} from '../src/engineering/ladder';
describe('program editing and symbol metadata',()=>{
 it('supports undo, redo and invalidates redo on new edit',()=>{
  const a=createHistory(conveyorStarter);
  const b=commitDocument(a,{...a.present,id:'edited'});
  expect(undoDocument(b).present.id).toBe(conveyorStarter.id);
  expect(redoDocument(undoDocument(b)).present.id).toBe('edited');
  expect(commitDocument(undoDocument(b),{...a.present,id:'alternative'}).future).toHaveLength(0);
 });
 it('stores symbol metadata without changing executable rungs',()=>{
  const doc={...conveyorStarter,symbols:{Start:{description:'Start pushbutton',address:'I0.0'}}};
  expect(validateLadder(doc)).toEqual([]);
  expect(doc.rungs).toEqual(conveyorStarter.rungs);
 });
 it('rejects invalid symbol addresses',()=>{
  expect(validateLadder({...conveyorStarter,symbols:{Start:{description:'Button',address:'!!!'}}}).length).toBeGreaterThan(0);
 });
});
