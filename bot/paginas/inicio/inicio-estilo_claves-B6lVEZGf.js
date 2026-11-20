function s(t){const l=[];t&&t.ll&&/^[0-9]{1,6}$/.test(String(t.ll))&&l.push(String(t.ll));const n=/\/([0-9]{15,22})\/?$/.exec(t&&t.link||"");return n&&l.push("a:"+n[1]),l}export{s as c};
