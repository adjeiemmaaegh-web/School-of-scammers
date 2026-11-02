import {describe,it,expect} from 'vitest';
import {emptyLibrary,readLibraryWithRecovery,persistLibrarySafely,restoreLibraryFromRecovery,LIBRARY_KEY,LIBRARY_RECOVERY_KEY,LIBRARY_DAMAGED_KEY} from '../src/engineering/project-library';
const memory=()=>{const map=new Map<string,string>();return {getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v)},map}};
describe('offline project library recovery',()=>{
 it('preserves previous valid revision as recovery',()=>{const store=memory();persistLibrarySafely(store,emptyLibrary());persistLibrarySafely(store,emptyLibrary());expect(store.getItem(LIBRARY_RECOVERY_KEY)).toContain('plc-skills-lab-library')});
 it('rejects overwriting a damaged primary',()=>{const store=memory();store.setItem(LIBRARY_KEY,'broken');expect(()=>persistLibrarySafely(store,emptyLibrary())).toThrow()});
 it('reads valid recovery without mutating the damaged primary',()=>{const store=memory();store.setItem(LIBRARY_KEY,'broken');store.setItem(LIBRARY_RECOVERY_KEY,JSON.stringify(emptyLibrary()));expect(readLibraryWithRecovery(store).source).toBe('recovery');expect(store.getItem(LIBRARY_KEY)).toBe('broken')});
 it('restores recovery and preserves damaged bytes',()=>{const store=memory();store.setItem(LIBRARY_KEY,'broken');store.setItem(LIBRARY_RECOVERY_KEY,JSON.stringify(emptyLibrary()));restoreLibraryFromRecovery(store);expect(store.getItem(LIBRARY_DAMAGED_KEY)).toBe('broken');expect(readLibraryWithRecovery(store).source).toBe('primary')});
 it('does not overwrite a valid primary during recovery',()=>{const store=memory();store.setItem(LIBRARY_KEY,JSON.stringify(emptyLibrary()));store.setItem(LIBRARY_RECOVERY_KEY,JSON.stringify(emptyLibrary()));expect(()=>restoreLibraryFromRecovery(store)).toThrow()});
});
