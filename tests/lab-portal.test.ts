import {describe,it,expect} from 'vitest';
import {categories,labs,workspaces} from '../src/lab-catalog';
import {emptyProgress,markVisited,toggleFavorite,toggleCompleted} from '../src/lab-progress';
describe('full laboratory navigation',()=>{
 it('has unique lab identifiers and navigable available exercises',()=>{expect(new Set(labs.map(x=>x.id)).size).toBe(labs.length);expect(labs.filter(x=>x.status==='available').length).toBeGreaterThan(0);expect(labs.every(x=>x.route==='/engineering'||x.route==='/simulation')).toBe(true)});
 it('covers all five technical disciplines',()=>{expect(categories.every(x=>labs.some(l=>l.category===x))).toBe(true)});
 it('provides direct workspaces for programming, electrical and 3D',()=>{expect(workspaces).toHaveLength(6);expect(workspaces.some(w=>w.title==='Scan debugger')).toBe(true);expect(workspaces.every(x=>x.path.startsWith('/'))).toBe(true)});
 it('keeps local practice state immutable and deduplicated',()=>{const a=emptyProgress();const b=markVisited(markVisited(a,'ladder-motor'),'ladder-motor');expect(b.recent).toEqual(['ladder-motor']);expect(a.recent).toEqual([]);expect(toggleFavorite(toggleFavorite(a,'ladder-motor'),'ladder-motor').favorites).toEqual([]);expect(toggleCompleted(a,'ladder-motor').completed).toEqual(['ladder-motor'])});
});
