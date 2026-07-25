import { test } from 'vitest';
import { decodeProfile, encodeProfile } from '@/lib/profileCode';
import { emptyProfile, nextDuel, recordPick, QUIZ_LENGTH, QUIZ_AXES } from '@/lib/taste';
import { mulberry32 } from '@/lib/genome';
import world from '@/lib/data/world.json';
import fs from 'node:fs';

test('round trip a real 12-round run', () => {
  const atlas = JSON.parse(fs.readFileSync('public/atlas/manifest.json','utf8')) as any[];
  let fails = 0;
  for (let s=0;s<12;s++){
    let p = emptyProfile();
    const rng = mulberry32(0xf0f0 ^ (atlas.length+s));
    for (let i=0;i<QUIZ_LENGTH;i++){
      const d = nextDuel(p, atlas, rng, world as any);
      if(!d) break;
      p = recordPick(p, d, (i+s)%3===0?'a':'b');
    }
    const code = encodeProfile(p);
    const back = decodeProfile(code);
    if (!back) {
      fails++;
      if (fails<=2){
        console.log('FAIL seed',s,'code len',code.length);
        console.log(' moods', JSON.stringify(p.moods));
        console.log(' eras', JSON.stringify(p.eras));
        for (const ax of QUIZ_AXES) console.log('  axis',ax, JSON.stringify(p.axis[ax]), 'decisive', JSON.stringify(p.decisive[ax]), 'seen', p.seen[ax]);
      }
    }
  }
  console.log(`decode failures: ${fails}/12 full 12-round profiles`);
});
