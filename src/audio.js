export class Sound {
  constructor(){this.ctx=null;this.settings={sound:true,music:true,volume:.55};this.last={};this.musicTimer=null;this.musicNodes=[];}
  init(){if(!this.ctx){try{this.ctx=new (window.AudioContext||window.webkitAudioContext)();this.master=this.ctx.createGain();this.master.gain.value=this.settings.volume*.32;this.master.connect(this.ctx.destination);}catch{return;}}if(this.ctx.state==='suspended')this.ctx.resume().catch(()=>{});}
  configure(settings){this.settings={...settings};if(this.master)this.master.gain.setTargetAtTime(settings.volume*.32,this.ctx.currentTime,.1);if(!settings.music)this.stopMusic();}
  tone(freq,duration=.1,type='sine',volume=.2,slide=0,delay=0){if(!this.ctx||!this.settings.sound)return;const now=this.ctx.currentTime+delay,osc=this.ctx.createOscillator(),gain=this.ctx.createGain();osc.type=type;osc.frequency.setValueAtTime(freq,now);if(slide)osc.frequency.exponentialRampToValueAtTime(Math.max(20,slide),now+duration);gain.gain.setValueAtTime(volume,now);gain.gain.exponentialRampToValueAtTime(.001,now+duration);osc.connect(gain);gain.connect(this.master);osc.start(now);osc.stop(now+duration+.01);}
  play(kind){if(!this.ctx||!this.settings.sound)return;const now=this.ctx.currentTime;if(now-(this.last[kind]??-10)<({shoot:.09,kill:.12}[kind]||.05))return;this.last[kind]=now;
    if(kind==='shoot')this.tone(110,.07,'triangle',.1,45);
    if(kind==='tesla')this.tone(500,.12,'sawtooth',.025,90);
    if(kind==='build'){this.tone(420,.09,'sine',.24);this.tone(680,.14,'sine',.18,0,.075);}
    if(kind==='upgrade'){[440,660,880].forEach((f,i)=>this.tone(f,.18,'sine',.2,0,i*.09));}
    if(kind==='click')this.tone(620,.045,'sine',.12);
    if(kind==='wave'){this.tone(180,.3,'triangle',.2);this.tone(240,.3,'triangle',.15,0,.18);}
    if(kind==='leak')this.tone(170,.3,'square',.1,60);
    if(kind==='ability'){this.tone(65,.7,'sawtooth',.15,400);this.tone(500,.8,'sine',.12,50);}
    if(kind==='win')[330,415,494,660].forEach((f,i)=>this.tone(f,.6,'triangle',.24,0,i*.15));
    if(kind==='lose')[220,196,147].forEach((f,i)=>this.tone(f,.5,'triangle',.16,0,i*.2));
  }
  startMusic(){if(!this.ctx||!this.settings.music||this.musicTimer)return;let step=0;const notes=[110,130.81,146.83,164.81,146.83,130.81,98,110];const pulse=()=>{if(!this.settings.music||this.ctx.state!=='running')return;const time=this.ctx.currentTime,osc=this.ctx.createOscillator(),g=this.ctx.createGain();osc.type='sine';osc.frequency.value=notes[step++%notes.length];g.gain.setValueAtTime(0,time);g.gain.linearRampToValueAtTime(.06,time+.4);g.gain.exponentialRampToValueAtTime(.001,time+2.8);osc.connect(g);g.connect(this.master);osc.start();osc.stop(time+3);this.musicNodes.push({osc,g});this.musicNodes=this.musicNodes.filter(n=>n.end>time||n===this.musicNodes.at(-1));this.musicNodes.at(-1).end=time+3;};pulse();this.musicTimer=setInterval(pulse,2000);}
  stopMusic(){clearInterval(this.musicTimer);this.musicTimer=null;for(const n of this.musicNodes){try{n.g.gain.cancelScheduledValues(this.ctx.currentTime);n.g.gain.setTargetAtTime(.001,this.ctx.currentTime,.05);n.osc.stop(this.ctx.currentTime+.2);}catch{}}this.musicNodes=[];}
}
