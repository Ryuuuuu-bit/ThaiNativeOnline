import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CALM_MUSIC, musicAt, moodPitch } from '../src/data/calmMusic.js';
import { MAPS } from '../src/world/maps.js';
import { MUSIC, MUSIC_FOR } from '../src/data/audio.js';
import { LocationMusic } from '../src/audio/LocationMusic.js';

test('every real map/region/phase resolves to an original supported track', () => {
  for (const map of Object.values(MAPS)) for (const regionId of map.regions) for (const phase of ['morning','day','evening','night']) {
    const id = musicAt({ mapId: map.id, regionId, phase });
    assert.ok(CALM_MUSIC[id], `${map.id}/${regionId}/${phase}`);
    assert.equal(MUSIC[id].style, 'calm');
  }
  for (const id of Object.values(MUSIC_FOR)) assert.equal(MUSIC[id].style, 'calm');
});

test('geographical moods remain distinct and unsafe nights retain their identity', () => {
  const pick = (mapId, regionId, phase='day') => musicAt({ mapId, regionId, phase });
  assert.equal(pick('city','port'), 'calm_river');
  assert.equal(pick('city','market'), 'calm_market');
  assert.equal(pick('city','temple'), 'calm_temple');
  assert.equal(pick('city','halls'), 'calm_paddy');
  assert.equal(pick('paddy','rice'), 'calm_paddy');
  assert.equal(pick('city','market','night'), 'calm_night');
  assert.equal(pick('wat_rang','temple','night'), 'calm_ruins');
  assert.equal(pick('deep_forest','city','night'), 'calm_forest');
  assert.equal(pick('sunken_city','city','night'), 'calm_marsh');
  assert.equal(pick('sealed_mine','city','night'), 'calm_ruins');
  assert.equal(pick('ruen_ho','city','night'), 'calm_ruins');
});

test('border jitter never restarts music, stable area changes settle, warps switch promptly', () => {
  const played=[], route=new LocationMusic(id=>played.push(id));
  const at = regionId => ({ mapId:'city', regionId, phase:'day' });
  route.update(0,at('port'));
  for(let i=0;i<30;i++) route.update(.3,at(i%2?'port':'market'));
  assert.deepEqual(played,['calm_river']);
  route.update(0,at('market')); route.update(2.1,at('market'));
  assert.deepEqual(played,['calm_river','calm_market']);
  route.update(0,at('temple')); route.update(3,at('temple'));
  assert.equal(played.length,2,'minimum phrase dwell');
  route.update(5,at('temple')); assert.equal(played.at(-1),'calm_temple');
  route.update(0,{mapId:'wat_rang',regionId:'shrine',phase:'night'});
  assert.equal(played.at(-1),'calm_ruins');
});

test('all scores have bounded pitches/timings, quiet night differs from bright market', () => {
  for(const track of Object.values(CALM_MUSIC)) {
    assert.equal(track.chords.length,16); assert.equal(track.melody.length,16);
    for(const chord of track.chords) for(const n of chord) assert.ok(moodPitch(n,track)>20 && moodPitch(n,track)<100);
    for(const bar of track.melody) for(const [at,n,len] of bar) {assert.ok(at>=0&&at<4&&len>0);assert.ok(moodPitch(n,track)>20);}
  }
  assert.ok(CALM_MUSIC.calm_market.bpm>CALM_MUSIC.calm_night.bpm);
  assert.ok(CALM_MUSIC.calm_market.wood>CALM_MUSIC.calm_night.wood);
  assert.equal(moodPitch(66,CALM_MUSIC.calm_forest),65);
});
