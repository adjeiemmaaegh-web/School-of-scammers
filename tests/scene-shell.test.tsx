import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {SceneShell,supportsWebGL} from '../src/components/SceneShell';

describe('CPU-only graphics fallback',()=>{
 it('does not require a browser or WebGL at render time',()=>{
  expect(supportsWebGL()).toBe(false);
 });
 it('shows current machine status and does not mount optional 3D children on a headless device',()=>{
  const markup=renderToStaticMarkup(
   <SceneShell title="Training conveyor" summary="Motor stopped, sensor input open">
    <div>3D-only content</div>
   </SceneShell>
  );
  expect(markup).toContain('Training conveyor');
  expect(markup).toContain('Motor stopped, sensor input open');
  expect(markup).toContain('3D not supported');
  expect(markup).not.toContain('3D-only content');
  expect(markup).toContain('aria-live="polite"');
 });
});
