// Confirmed attacker intent. Public zone vulnerability is a different state.
export class PkMode {
  constructor() { this.reset(false); }
  reset(online) { this.online=online; this.on=false; this.known=false; this.pending=false; this.elapsed=0; }
  sync(on) { if(typeof on!=='boolean')return; this.on=on; this.known=true; this.pending=false; this.elapsed=0; }
  request() { if(!this.online||!this.known||this.pending)return null; this.pending=true;this.elapsed=0;return !this.on; }
  update(dt) {
    if(!this.pending)return false;
    this.elapsed+=dt;
    if(this.elapsed<5)return false;
    this.pending=false;this.known=false;this.elapsed=0;return true;
  }
}
