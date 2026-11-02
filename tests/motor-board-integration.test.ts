import {describe,it,expect} from 'vitest';
import {initialWorkcell,stepWorkcell} from '../src/engineering/workcell';
import {newBoard,changeBoard,type Board} from '../src/engineering/wiring-board';
function boardWithMotor(wired:boolean):Board {
 let board=newBoard();
 board=changeBoard(board,{kind:'add',part:{id:'MOTOR',kind:'load',label:'Conveyor motor',x:600,y:260}},false);
 board=changeBoard(board,{kind:'add',part:{id:'K2',kind:'relay-contact',label:'K2 NO',controlledBy:'RunLatch',x:600,y:90}},false);
 const connections:[string,string][]=[['PS.P','I0.IN'],['PS.M','I0.COM']];
 if(wired) connections.push(['PS.P','K2.A'],['K2.B','MOTOR.A'],['MOTOR.B','PS.M']);
 for(const [from,to] of connections)board=changeBoard(board,{kind:'connect',from,to},false);
 return board;
}
function start(board:Board){let s=initialWorkcell();s=stepWorkcell(s,'press-start',20,undefined,board);return s;}
describe('motor circuit integrated with PLC scan',()=>{
 it('does not run an unwired motor despite the RunLatch command',()=>{const s=start(boardWithMotor(false));expect(s.runLatch).toBe(true);expect(s.motor).toBe(false);});
 it('runs when motor is wired through a PLC-driven contact',()=>{const s=start(boardWithMotor(true));expect(s.runLatch).toBe(true);expect(s.motor).toBe(true);});
 it('stops on PLC stop even with motor wiring intact',()=>{const b=boardWithMotor(true);let s=start(b);s=stepWorkcell(s,'release-start',20,undefined,b);s=stepWorkcell(s,'press-stop',20,undefined,b);expect(s.motor).toBe(false);});
});
