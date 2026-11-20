import {writeFileSync} from 'node:fs';
import {lessons, summary, guide} from './lessons.js';
writeFileSync('public/lessons-fa.md', '# تکتیک‌لب — پنج سناریوی Unity\n\n' + guide + '\n\n' + lessons.map((l,i)=>`## ${i+1}. ${l.title}\n\n${l.desc}\n\n### الف) کد ضعیف\n\n\`\`\`csharp\n${l.bad}\n\`\`\`\n\n### ب) ضعف‌ها و نسخهٔ درست\n\n${l.issues.map((s,j)=>`${j+1}. ${s}`).join('\n')}\n\n\`\`\`csharp\n${l.good}\n\`\`\`\n`).join('\n') + `\n## جمع‌بندی\n\n${summary.map(s=>'- '+s).join('\n')}\n`);
