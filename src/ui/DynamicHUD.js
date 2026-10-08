// Presentation only. All values come from the live character/combat/network state.
export function attachDynamicHUD(game, net) {
  const c=game.game.character, frame=game.game.characterUI.frame;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  document.body.classList.add('hud-dynamic');
  const footer=document.createElement('div'); footer.className='hud-vitals-footer';
  footer.innerHTML='<span class="hud-state" role="status"></span><span class="hud-wallet" title="ทองในกระเป๋า"></span>';
  frame.querySelector('.g-player-info').append(footer);
  const state=footer.querySelector('.hud-state'), wallet=footer.querySelector('.hud-wallet');
  const hp=frame.querySelector('.g-hp'), mp=frame.querySelector('.g-mp');
  hp.dataset.label='HP';mp.dataset.label='SP';
  for(const [bar,name] of [[hp,'HP'],[mp,'SP']]){bar.setAttribute('role','progressbar');bar.setAttribute('aria-label',name);bar.setAttribute('aria-valuemin','0');}
  const trail=document.createElement('i');trail.className='hud-hp-trail';hp.append(trail);
  const tools=document.querySelector('.online-actions');
  if(tools){
    const toggle=document.createElement('button');toggle.className='hud-tools-toggle';toggle.type='button';
    toggle.textContent='⋯';toggle.title='ตัวเลือกปาร์ตี้';toggle.setAttribute('aria-label','ตัวเลือกปาร์ตี้');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','hud-party-tools');
    const drawer=document.createElement('div');drawer.className='hud-party-tools';drawer.id='hud-party-tools';drawer.hidden=true;
    for(const button of tools.querySelectorAll('[data-follow],[data-warp]'))drawer.append(button);
    tools.insertBefore(toggle,tools.querySelector('[data-target]'));tools.append(drawer);
    toggle.addEventListener('click',()=>{drawer.hidden=!drawer.hidden;toggle.setAttribute('aria-expanded',String(!drawer.hidden));});
    window.addEventListener('keydown',e=>{if(e.code==='Escape'){drawer.hidden=true;toggle.setAttribute('aria-expanded','false');}});
  }
  const minimap=document.querySelector('.minimap');
  const layout=()=>{
    if(!tools||!minimap)return;
    const origin=tools.offsetParent?.getBoundingClientRect().top??0;
    tools.style.top=`${Math.round(minimap.getBoundingClientRect().bottom-origin+8)}px`;
    const quests=document.querySelector('.exploration');
    if(quests&&!document.body.classList.contains('ui-compact')){
      const zoom=parseFloat(getComputedStyle(quests).zoom)||1;
      quests.style.top=`${Math.round((tools.getBoundingClientRect().bottom-origin+12)/zoom)}px`;
    }
  };
  if(tools&&minimap){const observer=new ResizeObserver(layout);observer.observe(minimap);observer.observe(tools);window.addEventListener('resize',layout);layout();}
  let timer=1,lastHp=c.hp,lastLevel=c.level,lastMode='',lastGold=-1,damageAnimation;
  const cooldowns=new WeakMap();
  return {
    update(dt) {
      if((timer+=dt)<.1)return;timer=0;
      hp.setAttribute('aria-valuenow',String(Math.ceil(c.hp)));hp.setAttribute('aria-valuemax',String(c.maxHp));
      mp.setAttribute('aria-valuenow',String(Math.ceil(c.mp)));mp.setAttribute('aria-valuemax',String(c.maxMp));
      const combat=game.game.combat, fighting=combat.inCombat || combat.combatTimer>0;
      const mode=!c.alive?'dead':!net.online?'offline':fighting?'combat':game.training?.busy?'casting':c.sitting?'resting':game.maps.map?.safe?'safe':'explore';
      if(mode!==lastMode){
        lastMode=mode;document.body.dataset.hudState=mode;
        state.textContent={dead:'หมดสติ',offline:'กำลังเชื่อมต่อ',combat:'กำลังต่อสู้',casting:'ร่ายวิชา',resting:'กำลังพักฟื้น',safe:'เขตปลอดภัย',explore:'พร้อมผจญภัย'}[mode];
      }
      if(lastGold!==c.gold){lastGold=c.gold;wallet.textContent=`◈ ${c.gold.toLocaleString()}`;}
      const percent=Math.max(0,Math.min(100,c.hp/c.maxHp*100));
      trail.style.width=`${percent}%`;
      if(c.hp<lastHp && lastHp-c.hp>=1 && !reduced.matches){
        damageAnimation?.cancel();
        damageAnimation=trail.animate([{width:`${Math.min(100,lastHp/c.maxHp*100)}%`},{width:`${percent}%`}],{duration:750,easing:'cubic-bezier(.22,1,.36,1)'});
        frame.querySelector('.g-player-info').animate([{boxShadow:'0 0 0 1px #ee9070, 0 0 24px #bb4a373d'},{boxShadow:'0 0 0 1px #d9ba7040, 0 12px 28px #0005'}],{duration:500});
      }
      lastHp=c.hp;
      if(c.level>lastLevel && !reduced.matches)frame.querySelector('.g-portrait').animate([{filter:'brightness(1)'},{filter:'brightness(1.7)',offset:.3},{filter:'brightness(1)'}],{duration:900});
      lastLevel=c.level;
      for(const b of document.querySelectorAll('.hotbar-slot')){
        const cooling=b.classList.contains('cooling');
        if(cooldowns.get(b)&&!cooling&&!b.classList.contains('locked')&&!b.classList.contains('nomp')&&!reduced.matches)
          b.animate([{boxShadow:'0 0 0 1px #f3daa0, 0 0 18px #d8b575aa',filter:'brightness(1.4)'},{boxShadow:'inset 0 0 0 1px #dec48a35',filter:'brightness(1)'}],{duration:650});
        cooldowns.set(b,cooling);
      }
    },
  };
}
