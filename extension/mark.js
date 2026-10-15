// 统一呈现层 —— agent 在这个页面上的「身体」，人看的那一侧全在这里
//
// 这个产品最反直觉的一点：agent 干活时**不抢焦点**，全在后台标签页里。
// 好处是不打断用户，代价是他完全看不见发生了什么。隔离逻辑（agentTab:<sid> 槽）
// 早就有了，但它只对 agent 说话，从来没对人说过。这个文件补上人的那一侧，
// 按三个递进层次回答三个问题：
//
//   存在感 —— 它在哪：彩色标签组（background 侧）+ 页内四边描边
//   动作感 —— 它此刻在做什么：呼吸泛光的箭头光标，滑到哪就是在动哪
//   意图感 —— 它在想什么：浏览器侧栏（正在做 / 准备做 / 时间线），页内只留一个小头像入口
//
// 2026-10-13 驾驶舱搬进侧栏（agentchrome定的）。页内的胶囊/卡片常驻右下角，而聊天、IM
// 类页面的发送按钮恰好最常在那里——实测在 1512×861 的豆包页面上正好压住发送键。
// 外部参照（Gemini in Chrome、Atlas、Claude in Chrome）也都把状态放在浏览器界面层，
// 内容区零浮窗。页内剩下的小头像会避开可交互元素，人手靠近时让路。
//
// 品牌的边界（agentchrome定的）：头像只出现在**我们自己的标识位**——小头像入口、侧栏、ask 浮条、
// 扩展图标、标签组。favicon 是网站的门牌，不动；指针是指针，不拿头像替。
// 标题 emoji 前缀已退役（丑），标签栏的存在感交给彩色标签组；
// 顺手消掉「污染 document.title」的已知副作用（少数站点拿它做分享标题），
// identity.js 里的 stripMarkPrefix 留作过渡清理。
//
// ask（人工介入浮条）也并进来了：页面上只该有一套我们的 UI，两个文件各画
// 各的迟早叠在一起。合并还白捡一个修复——ask 从此也在 context 看门狗的
// 保护之下，扩展重载不再留下一块永远没人回应的浮条。
//
// 三条铁律（背后各有一次真实事故或一类必然事故）：
// 1. 呈现绝不挤进命令的关键路径——所有动画 fire-and-forget，永不被 await。
// 2. 数据不当代码用——agent 声明的意图、act 文案、ask 正文可能源自被注入的
//    页面，一律 textContent，绝不拼 innerHTML。
// 3. 信号诚实——呼吸=正在干活的承诺。会话空闲后光标必须休眠，不能骗人。
//
// 样式全装在 shadow root 里：页面一个 `div { font-size: 0 }` 就能让普通浮层
// 消失，shadow root 是唯一彻底的隔离。

(() => {
  if (window.__hcMark) return;
  window.__hcMark = true;

  // 顶层框架才画。content.js 是 allFrames 注入的，本文件按设计只注顶层，
  // 但防御性地守住：iframe 里也画的话，一个带广告的页面会冒出七八套 UI。
  const TOP = window.top === window;

  // agentchrome 头像（深蓝底+白光标+琥珀火花，与扩展图标同源），64px 圆形 PNG。内嵌 base64 而不是
  // chrome.runtime.getURL：后者要开 web_accessible_resources，任何网页都能
  // 借它探测扩展存在（指纹）。页面里的呈现一律画到 canvas 上
  // （createImageBitmap(Blob) 是纯内存操作），绝不走 <img src="data:">——
  // 严格 CSP 的站点 img-src 不带 data: 时那条路会静默烂掉。
  const AVATAR_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAAXNSR0IArs4c6QAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAAAQKADAAQAAAABAAAAQAAAAABlmWCKAAAVhUlEQVR4AbVbCZhW1Xn++GGAWdgFXAAFFCe1LpXg9uBK3E0UxRitVuMCrY2K+qRNbVGjSVolCoY+RNS4RU00AioaFzQGW4sSwaiJCy6DENCALLPCDDPz933f75xz7wzDKp7hv/cs3/K+3/nO3elURLGvsKxZV29/eLvKFlettKqlq6xq2Spbs7bW6tc3WX3DBnguWllZNyvv3tX69iqzvYbsYsOHDLR9hg60Qw4abn17V3yF6Mw6fRUB+NPiFTbnxbfs1Tc+tA8++Ss4eoyLxVZUi9apE7vQh7Y3sM/NQ15uxNBd7chDKu1bJ460/SuH7PRg7LQA1Dc02q+ffsMe/+0i+/jTleADUqEUW1lnEEianUX9iTSJMyCS8ZFOHGWgomQYGzF0Nzv7m4fZeWNHW3lZdxr60uVLB6CmboM9MHO+PTjrNauuWQ9ABB9mVMQicSctUgpOoKc6yYJ2qCs7SA1BYF8MBNssPXuU2nfPOdYuOXcM6mXq29HNDgeAIGc9/0ebfNdcW401TZAsGflASKAduBMgqSCHYDFg2oV6sRVtGZOQ2wsh0JJBPfro16fCfnDFWciKI7CSIgLB2ObNDgVg6Yq19q+3zLaF73wK8JhtOM/SnOQ4oySaESxazAqXzY4DlKGOLxPS8LrvY2bIFgYBOLMr2aKNOnC43X7TJbbnoAE0tV1luwPw3Lx37brJT1odjuAESoCA6qBEgv4zkIyBgsEZVkCcGGX4zzc+5k1uXT8LBvtgJdoP+yzARauoKLVbJ11kpx0/ika3uWxzAIj9ljtfsHt/82owjg7+ExhVnA+2IhxSuW02BHkYY8pSN5GAVQ+oKgwBO7SPWYAOyTMwsR51ovxlF5xok64+d5uXxDYFoLm51X5w6xP21Itvy3EGzEETDGeIy4GEBMpzXHWNCbyneZSNJEhHNoKut9nlhDUmEeqrEuyiTtfaBFnonH7y4Tb15vHWpUtnDm6xbDUAJH/59b+237+2GH4cgKJNp5qk9kdpIcoBzLUBLs68yAUbNMSgca/ZDm1fAtSPgdBCcFk3m/Tcno+T8bGjD7R7p1691SAUKLy5AryaeZEHCE6yComgGdMv9hEo/xGMRFlnIbkc+ZT2dOAKEhN8yfqxJS9He1pa1OEPHTFoQTmNU+93//OmTfyPOyETQUSptvstBoBrfs5LSPtAgI6j04x8vs8Jccwd+6yqHgB7P3QSDtf3gIUMw2D0I58hSNT1/twBEXbcZtjLD+WKNvuZ/7Wbb3s4eeqostkA8Gh/3+P/B+4gk4MLN3SZeuScUU6MWBEd9cUrPBKJuk7W2xl4D5aDDLIkzA5sXC5klnckexTwwLCLMv4jjBkPzLE5z8+nlQ5LhwFYumKNTnURvNYtzuNxVsjF0zH0OSM4IBAHQ1nJh1gQmC5yKMWMSqBFUW1ZzWcbeilHX9KnY/ZI3+zQYeuCzcxG5h9yvITG0PdvuNOWLMM9SQdlkwDQx7/81xM6zzOCLNEQQfjsOlFa13UAyUXgknBAujoLY5AIieFjPqNwQJuS4S5mQdBPxNGfC7J0MHbtqcuITkNOnHr48QzEfprHxNXUNdhV/zYNam4Xg6lsEoBZz79pi95ZAk3OYCAG8Rh17vMzQmIyHE57dKl20GU9ymMgBDMAzRFuIyN/tMMZJHmMajaDPtpfH1pto4bV4lcjf67vZyTHDvwhAwDJFix6zx594uVEPFbaBIA3Nry29+LXeCRkvIxVQR0kWmkY0WWc5ZiRZp/IAwSDIT3qAjS2se0jbkfdtKJguSz7ZDNoyQvGo34MxhUnLJf6FSdiL/0QKMlyiBkQcTi2H932oNXU1ksvbtoEgHd1a9bVSZnR9x/BOlnPCDfsdcjQEmQJurFupTXV+q1wlCU4/ShGoK7hPtiSH1oJTtTn/eyKOCAgEbYvPmaFHVVZra6jKmvsu0d/BoAeSApRJtNlm1lotnp1td31wFPSi5t0IcT7+aO/c5tV166XsIwEqTi7bpWdMOoeUHXgG2o+s5rlC6XRvfcQK+9faQWAkqSyIwaRs+HFgQby6CJQBjMrDl59YFBa0mITT1pm448D4XZlxksD7PZndrX1jZhTBSPYYYApS9uo8fZ54cu/sIryUlnooi02j+JhRk3thox8IOZHbgJz0koqgWSNJn2sdSOfBXjZsG6pFVs2WsXA/dQhHUoKRKbj0oKHqgOMfVG2pNBsBw+tszH7rbEzR62yfhXNLtJuO2HMSht3yGqbuaCvzX27py2qKrWmZsfoHomzFc8s6u2Xjz5n/3TxWFlIS4BPciRIciKP2RPgAAy2ImXWOHueJTRMlfzMmTXWfma1n70Fn82i5nhpC4V29XMdt8UxDzJrvnzjQc1TmKpbLhlh5p5K8OVtjhftVzPjcQ5+QLLIZ3hjx0/XIJVInAopAMS7lfv5hjWfWP2q96neppSU9rEeu+4PT7gxYRBhO9mFZPTVigD6YZfjMTBOPLZLS5rt6pOX2/gxn7fxwcaMF/tjCQy09U2dpS+qOTtkgAHpMcxzZ021A/bb25QBc3SXh7FctCJI1wnRpLo6AshQ97NEJnPEYSOtUPDk2rh+rVWveFOZQN0IwU2xRVsgyuMFADtZ9LNPYzGzitbQVLCfPDnIfjhzMNVT+eHM3e3Hs/ewBqz/GCzHTzNRn+IBI2zPfOpl6Qvlq2/4nV6A44IQ8uK9BMQigwLn6URH0ZnLm33rtBPs4QemWdeuJepqaay1ahwgW5v9IYrLBW8CGAIqgOwX9Zzd6MP39/6+v73yXg+ZmYf9L37XH8BANIcZku30GQgPMgMx79U3pV/gc/vFVbhMxAzQLY3E87wMalYkiyaNQCbMlupsd1BOO+UbNvuxe/CkplyjrRsbrAaZ4AdLgnNb8WqD4VQhBF3A5LPCsyHv6mfPDpT4tGf5GIwYKM8dbCd9bzM4YhfxQ+a9xUts9ZpqKyx4qwrjDshnMuc4eQyAoSjANERH+LnvUIe/fDnqyMPs6dn3W98+vdXd2tyIIPzRNiIjAmYFgsEg6My/W4lBojDHdBxiHbILPqmwBR+V2+v4+Rgh5QKRdNgXZl54aYeyrTZ/wTtW+GjJyuiN3fqHUah4U4OBcLZO3RHlgoLEOtqMPPgAe+7ph2233fyBZbF1o9V99o41N/ISNmRUUFTiw2Yk4vto1TGpL6TL5DnMgojVsSiYrLLAfpuZj2lGfvi9/+ESK3yC11URSOY4zoYDjE7deHDkLuhF+tF26s5Vvla5t8397a9s2NAh6i0WW6z2r382HiBZItHMTwgCgXJcKU05zzxUcNxttdc+LPdxthMOaEDOOck6FdMvz/XjT/5iBb6rcwEKs9BYoEM9OmcJTjiu0eSU8hz2vRodbPYcMkhB2O9v9vVRgKxf9YE11X9BbehnfpgJOh6Ri/ppm3307HVoeCvhoL5yqI2slpZ00J3bU//jqmVW4ItKWdKgR55O48/HqIsxPulVlc4o63t1JuPe6mg7YMAuWA4P2aGj/i4M49S2+iNrqov36nn/8BBm3mln/hhs9RETMSgIQUrY2QUOwgtZHrRzeKP+F2vWWYFvaWkgM+RxJELdTYUxGsgCRRUGA065Vz1w2squd6+e9tSs+2zMsaOT5Pq1n9qGmhXBJv04Ge544JNv4ch8qY+YIi4FIruY8n6Oo6ZAUldN74O9+vp6K/gLDozIGyUYDApzz0xgtL2tvmhMfTEDXC8zv+VaWVmpPfbIz23s6Sclwcaa5bahelmIccjAkAHuPmCThmPUpBEd5VAooW3CTxpBjwHiKPbOp9Vqaxtww0Y1RlpGnLRmXubaOqVxnxv0yzBNUplt1re9dO3a1e6/Z4pddMHZSakJt9MNyIYIOsMRA01RYAyTkB0T1CscHhQHI26Jh+uyGa9zyKXAjxNg0aOCjnjaIAgBETk3qL7EFOP8C1lCCNtbeLk8beqPbOIVlybVjQ2rbf3aJYCU2aZfgmWgSV51NREY9tF3lAk4In4FBMPUcazQ5zEB8uXl3a1QgS8zWKICb0rQ0k+OsIkk1YYiOjCugVBne8fLzTd+326cdE0y0LyhGkGokl+fRbpxTKg5G+zjn3ChRewSo0z4OVlfynSQOGC8orzMCr3xWQoJxnSjQ3fmTrOIsz+sI8l43R0l7DtcuXbiBLvj9psCDrOWpjrjHWZrawtsBqryD4T5JQDGjsuzJOGPWLW0aSIGIcgjRn379rTCUHyTA/vJSDzVqZMDch55sY3CMOsXApKM+/CObi++8By77+7b8DrLn9PwvmH9miprxcMVzwTOX8SUEdeECVokh0ZIc5cHTrTdhgQBv2jD9xpkhWGDwyWqIokoygcU1OZ6QwcJIpLuw8fcMMVyB8YdZZ7TO2vsqTpDlJb6JzCtLY0IwhJraebpOuCCvFKZiOg/kE2ZG/olT9sS8wwgB2HGu729hw+xwohhu6KLREVPg9IRMfTSKca0RBgUDsYt2qx7EByShr/k5vgxR9mTM++1Xj39lpf3D3zMxttpFeLIZ13A6AHy4KTlGjBGzFCECcdcuc9eVuCnaCzqToaiEGed9SwQ0XDQSAHyOzWZ2imbww8dac/Oecj69+8ne3y0tr76L9aM2+pIRsmqYAAj9xrxbSQacWqQbMgRsnxge/ihB1mB3+GNGLabVN1gJC2/0k+koRhTz/vY9h7fBp2dtNv/byvthWcescGDdneLAN9YvRwHyAZwCEQDbcIQBsj4eR4tiZA01blXRYKVI/ayXfr1Nh1tjhy1L24N42smLgaPlJNyR1FZo4piwMR63rh3b9eWgJcuWw7gAWBOm9cKM6bfYhdeMtFWrVotX3zg2rVigHUuCWcwUFcGBoLx1OcRoLFAHljj2DGj/VMaBYAfId79yIsQzFI9XhDJCAzHYCgQdMQDj04xm4Kmy+0pZ587wV548ZXtUcEN1EorKR9gXUr4fB8YRJ57miFekva6KuSQO1iOG3s8B/2hKL/A5EeI8ahJxZjiVOYfjZK898dAyYb6vbb925aWFnt53vztV4RGEWcIx8UsJGZtA06vp3GuiIB/Xxz8Dty/kgIeAFb4BSaFvThhWgw2pczxmAkcc/lMNihvcTf3pVcw2/OSTOfOnW3cmaektnUqWAGzmn5dUO+CS9b2P6R/l64VjotYEp5oyvs8S8UeA471/O98MwplAeDnp7168PmaHyVpkOJOOhiTE/ryiEsm3HMni1uoTLpxsp357cvsrHPG2+wnn0uSV185PtVps1vFbta95x7Wvcfu2KPeaw/rhn23HgP14/rvVo4LOKU0sGAfyfks57I1jpEPlixvxy887/Tkzx/eo8lvby8655hkiBJcRyJJwpp6jyD7okPuo3vqbK6Q/NRp96ThW346PdX5yOyUk44L7aI1b1iHOnzwQyTWeKyhT296X8DgsJywj/v6p3C6dgF+TSeEJ1x8Np5UZ5/XpgDQKr+97YfTIv3E9aLjAiMdQGivyAenQVbBopEOSnvyFPnzux/Y83PnJemrr7os1TfiZqiIewBxDkRj1nHvE8MrO9IkjjBBeVmOkbjkYRpju/TtZf946TnJDyttAsA3p/z21snEcCNswTDdKe1CMJRd7MM4A9ZRaU+eazmWKXfcFat22CEH48JkpLfx0LQZj84zHNE2fbW9n1cGEGJYisShmaegCkPEUrQbrvteurpUFzZtAsBOfng88oDhIMS0w78QRSmEdkpNkhZ5zoCgSCxu2pMvKetnfHWu94QQenX+G/b6H/wNDXWumZgdC3hLzOuDiIPWI5bsdBZSm6RFk/tMLuoyiw8ddYCd9+1T6aZN2SQAND4FHx73wL0yTLkwiebqfvXnqUcnvtYQhFzpiHw3HLwo27WsT5KccsfdqX7i8Ufb1yr3UZuXvi0b6yXvxB2LwpzHk5t5zr4/z6AJBgPS+Mc1P33q9Y4zefPKJgFgN7+6vvX6ixDxuL4Q31jHeDweCAw8cCxfZtzzUJsDHmeeR27NCOS7dOsFcdd+5tmX7P0PPpY6g3NN7ljALJAvjioTfSLSzIKk/uA/JiCtuh/fU3/aT//dhu45SD7abzoMAIX41fVl55/gMDnLSTM69YMQ3ASHWRCqlvCy2gvJa+Yh56QBFpe3XbozCF6mTsuyYNyZp6Zrf35k0aIPL3yJxTSnlk+IBwQNtYWFx6dUiva9CefZ6aeNST3tK5sNAAUnXXOunYEPj5MzzrR+Ie0DeQUn4598lJT1FflMH+AIFhIlpf6+kMKP/maOLV/+ufT4MOTKf75YdW74ZpkKcRlQl/Y66RTJAReN474cpWBnnXGC3TTpShfYzHaLAaCxKfjq+rgjD6Jb/bnHbEko5SKKnBOf+YECnnUntMiCztYZV3Iszc3NNu3n9yWxfzh/nPXr68cJPhDhS9UcU9UZBAbT+7neWbJs/Maxh2Pd39Dhupdo2GwxAJThJ+f86vqMk49AK6Ya08ydRyCFgn8LQJ1szVOGJQJj4KJu2yy4/8HHbO26aknzvcH4S/9edW6amzwLkh1mQBj1mfezgbDA1zjM/MP3TbaS8GgtGeqgstUAUIdBmPafl9v4C7LTCA8u8WxAYF2697DSXoNx2TrYupbzgwWmKZQ1Uy6byKOPYAudS3TNTx/19Q024+6HWLU3Fr5t819fqDo3zAC+UHWC6IDdZEsT4eHgMeLyy861GdNu2ibytJ0+k2NjW8rTL7xm106abrX1+CosEEHFVUlW9ZgpDjTdWodxl8YWbR7k4rtBpv3Ig/ff9NYY3xcxq0iQy1LkqU5fwSZPdT/D0f6MLRzwOuK33QGgEX54fNV1/20LFr4rwj7RpJWlOus8dXG6stmiiAeHZOKHUY21n+PJL9d5+9IJx4kyPfigHWYUs4D28j55kcPz/OZOde2t5ts7FAAaIBB+e/tjfH76Bb7ARE8A5oTREkjJ6tTEAFGPQVHF95Brbqo3vhHKComXi7xmnPrOPui7LV7b8/KWV3g6+mcGtrm2wwGIHvjt7V34Jv/uB5/SR4gMRJx5Pm3WK64UDJ99D5YHSOsaQeHHEi1Y653xLIDkRSjMNmdfdmGHAeyDW9rxuKvjjU18chzxbO/+SwcgOqzDMeGXjz1vjzz+gi3+cKkDBgEBT+vWZ5+kPYV5MeXrWld6Ch40oh6zJcw8Om3EPnsaH2bwfj5/Sxsx7Mh+pwUg7/ytP31ks+a8jE/RFtn7iz/1p7Qih4CEdUxCzBB2s6SlEeS4hPjounLEUDt69NeNz/AOCo+xXGPnbL+SAOSh8VM0fo3FD5L4Tc5HVUvx3+drrK62zmrxHxkYAX64zBnt27unDR82yPYeOhjEh+H2+EA9us7b29n1/wc1xMh1g8Xu2wAAAABJRU5ErkJggg==';

  let bitmapP = null;
  function avatarBitmap() {
    if (!bitmapP) {
      const bytes = Uint8Array.from(atob(AVATAR_B64), (ch) => ch.charCodeAt(0));
      bitmapP = createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    }
    return bitmapP;
  }

  // 头像 canvas（2x 抗高分屏）。位图异步到位，到位前是空白圆——几十毫秒的事。
  // 构建失败（极端环境）退化成色点，品牌让位给可用性。
  function avatarCanvas(size, cls) {
    const c = document.createElement('canvas');
    c.width = c.height = size * 2;
    c.style.width = c.style.height = `${size}px`;
    c.className = cls || 'ava';
    avatarBitmap().then((bmp) => {
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    }).catch(() => { c.style.background = '#a8a29e'; });
    return c;
  }

  // ---------- 状态 ----------

  let owners = [];      // [{ emoji, color, label, code, sid }]
  let tabLabel = '';    // agent 开页时声明的「这页是哪条线」（属于 tab，不属于某个主）
  let host = null, wrap = null;
  let watchdog = null, flashTimer = null, placeTimer = null;
  const actState = new Map();   // sid -> { text, timer } 「刚刚做了什么」的短暂高亮

  const CSS = `
    :host { all: initial; }
    .wrap { font: 500 12px/1.6 -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif; }

    /* ---- 四边描边：常驻答「有没有主」，亮一下答「它刚动了」 ---- */
    .edge {
      position: fixed; pointer-events: none; z-index: 2147483645;
      opacity: .38; transition: opacity .18s ease, filter .18s ease;
    }
    .edge.t { top: 0; left: 0; right: 0; height: 2px; }
    .edge.b { bottom: 0; left: 0; right: 0; height: 2px; }
    .edge.l { top: 0; bottom: 0; left: 0; width: 2px; }
    .edge.r { top: 0; bottom: 0; right: 0; width: 2px; }
    .lit .edge { opacity: 1; filter: saturate(1.3); }

    /* ---- 虚拟光标：agent 的注意力在页面上的具象 ---- */
    /* 只动 transform/opacity——合成器动画，零重排。它要陪着页面跑几百个动作。 */
    .cursor {
      position: fixed; left: 0; top: 0; z-index: 2147483645;
      pointer-events: none; opacity: 0;
      transition: transform .24s cubic-bezier(.2,.8,.3,1), opacity .4s ease;
      will-change: transform;
    }
    .cursor.on { opacity: 1; }
    .cursor .glow {
      position: absolute; left: -32px; top: -32px; width: 64px; height: 64px;
      border-radius: 50%; background: radial-gradient(circle, var(--c) 0%, transparent 62%);
      opacity: .5; animation: hcBreathe 2.4s ease-in-out infinite;
    }
    @keyframes hcBreathe {
      0%, 100% { transform: scale(1); opacity: .38; }
      50%      { transform: scale(1.35); opacity: .68; }
    }
    /* 箭头就是箭头（agentchrome定的）：白箭头+会话色描边，品牌感交给色环和泛光 */
    .cursor svg { position: absolute; left: -2px; top: -2px; filter: drop-shadow(0 1px 2px rgba(0,0,0,.35)); }
    /* 休眠：呼吸是「正在干活」的承诺，空闲 30 秒就得收起来，不能骗人 */
    .cursor.doze { opacity: .45; }
    .cursor.doze .glow { animation: none; opacity: .15; transform: scale(.55); }
    .cursor.doze svg { opacity: .6; }
    .cursor .ring {
      position: absolute; left: -18px; top: -18px; width: 36px; height: 36px;
      border: 2.5px solid var(--c); border-radius: 50%;
      animation: hcRing .55s ease-out forwards;
    }
    @keyframes hcRing {
      from { transform: scale(.35); opacity: .95; }
      to   { transform: scale(1.9); opacity: 0; }
    }
    .cursor.typing .glow { animation: hcType .5s ease-in-out infinite; }
    @keyframes hcType {
      0%, 100% { transform: scale(.9); opacity: .5; }
      50%      { transform: scale(1.1); opacity: .8; }
    }
    .cursor.pressed svg { transform: scale(.85); transition: transform .12s; }
    /* bob 动画挂在 svg 上而不是 .cursor 上：.cursor 的 transform 是定位用的
       内联样式，keyframe 一接管它，光标会瞬移回 (0,0) */
    .cursor.bob svg { animation: hcBob .5s ease-in-out; }
    @keyframes hcBob {
      0%, 100% { transform: none; }
      50%      { transform: translateY(26px); }
    }

    /* ---- 入口：一个会避位的小头像。状态和时间线在侧栏里，点它打开 ---- */
    .dock {
      position: fixed; z-index: 2147483646;
      display: flex; flex-direction: column; gap: 8px;
      transition: opacity .25s ease;
    }
    .dock.at-r { align-items: flex-end; }
    .dock.at-l { align-items: flex-start; }
    /* 让路：agent 要点的目标落在入口底下时，它必须瞬间变成「不存在」——
       真实事件(L2)打的是坐标，不让路就是替 agent 点了我们自己的东西 */
    .dock.dodge { pointer-events: none; opacity: .12; }

    .pebble {
      position: relative; width: 28px; height: 28px; border-radius: 50%;
      display: grid; place-items: center; cursor: pointer;
      background: rgba(24,24,27,.82); box-shadow: 0 2px 10px rgba(0,0,0,.25);
      opacity: .72; transition: opacity .18s ease, transform .18s ease;
      animation: hcIn .24s cubic-bezier(.2,.8,.3,1);
    }
    .pebble:hover { opacity: 1; transform: scale(1.08); }
    /* 人手让路：鼠标移到入口上、而它底下压着页面的按钮时，入口变成可点穿的影子。
       页面的按钮永远优先于我们的入口 */
    .pebble.yield { pointer-events: none; opacity: .1; transform: scale(.8); }
    .pebble .ava { border-width: 2px; }
    .pebble .n {
      position: absolute; right: -4px; top: -4px; min-width: 14px; height: 14px; padding: 0 3px;
      border-radius: 7px; background: #f97316; color: #fff; font-size: 9px; line-height: 14px;
      text-align: center; box-sizing: border-box;
    }
    /* 正在动手：色环向外扩散一圈。停手 5 秒后收起（铁律 3） */
    .pebble.act::after {
      content: ''; position: absolute; inset: -3px; border-radius: 50%;
      border: 2px solid var(--c, #a855f7); animation: hcPing 1.2s ease-out infinite;
    }
    @keyframes hcPing { from { transform: scale(1); opacity: .9; } to { transform: scale(1.6); opacity: 0; } }
    @keyframes hcIn { from { opacity: 0; transform: translateY(8px); } }
    @keyframes hcPulse { 0%, 100% { opacity: 1; } 50% { opacity: .3; } }
    .ava { border-radius: 50%; border: 1.5px solid transparent; flex: none; background: #fff; }
    .own { display: flex; flex-direction: column; gap: 6px; align-items: inherit; }
    .tip {
      max-width: 220px; padding: 6px 10px; border-radius: 8px; font-size: 12px; line-height: 1.5;
      background: rgba(24,24,27,.9); color: #fff; box-shadow: 0 4px 16px rgba(0,0,0,.25);
      animation: hcIn .2s ease;
    }

    /* ---- ask：人工介入。刻意做成浮条不是遮罩——用户正被请求去操作页面，页面必须能点 ---- */
    .ask {
      width: 340px; max-width: calc(100vw - 40px);
      background: #fff; color: #1a1a1a; border-radius: 14px;
      box-shadow: 0 12px 40px rgba(0,0,0,.18), 0 2px 8px rgba(0,0,0,.08);
      border: 1px solid rgba(0,0,0,.08); font-size: 14px;
      overflow: hidden; animation: hcIn .22s cubic-bezier(.2,.8,.3,1);
      pointer-events: auto;
    }
    .ask .head {
      display: flex; align-items: center; gap: 8px;
      padding: 13px 16px; background: linear-gradient(135deg,#fff7ed,#ffedd5);
      border-bottom: 1px solid rgba(0,0,0,.06); font-weight: 600; font-size: 14px;
    }
    .ask .head .dot { width: 8px; height: 8px; background: #f97316; animation: hcPulse 1.6s ease-in-out infinite; }
    .ask .body { padding: 14px 16px 4px; white-space: pre-wrap; word-break: break-word; }
    .ask .note { width: 100%; box-sizing: border-box; margin: 10px 0 2px; padding: 8px 10px;
                 border: 1px solid #e2e2e2; border-radius: 8px; font: inherit; font-size: 13px;
                 resize: vertical; min-height: 34px; }
    .ask .note:focus { outline: 2px solid #fdba74; outline-offset: -1px; border-color: transparent; }
    .ask .foot { display: flex; gap: 8px; padding: 10px 16px 14px; align-items: center; }
    .ask .clock { font-size: 12px; color: #9a9a9a; margin-right: auto; font-variant-numeric: tabular-nums; }
    .ask button { font: inherit; font-size: 13px; border-radius: 8px; padding: 7px 14px;
                  border: 1px solid transparent; cursor: pointer; transition: .15s; }
    .ask .ok { background: #f97316; color: #fff; font-weight: 600; }
    .ask .ok:hover { background: #ea580c; }
    .ask .no { background: #fff; color: #666; border-color: #e2e2e2; }
    .ask .no:hover { background: #f6f6f6; }
    /* 支付确认：同一个浮条换一身红。这类打断一年遇不上几次，
       必须一眼就和「帮我解个验证码」区分开——看错了是要花钱的。 */
    .ask.danger .head { background: linear-gradient(135deg,#fef2f2,#fee2e2); }
    .ask.danger .head .dot { background: #dc2626; }
    .ask.danger .ok { background: #dc2626; }
    .ask.danger .ok:hover { background: #b91c1c; }
    .ask .what { margin-top: 8px; padding: 8px 10px; border-radius: 8px; background: #f8f8f8;
                 font-size: 13px; word-break: break-all; }
    .ask .amount { font-weight: 700; font-size: 16px; color: #dc2626; }
    @media (prefers-color-scheme: dark) {
      .ask { background: #1c1c1e; color: #f2f2f2; border-color: rgba(255,255,255,.1); }
      .ask .head { background: linear-gradient(135deg,#3b2a1a,#2c1f14); border-bottom-color: rgba(255,255,255,.07); }
      .ask .note { background: #2a2a2c; border-color: #3a3a3c; color: #f2f2f2; }
      .ask .no { background: #2a2a2c; color: #ccc; border-color: #3a3a3c; }
      .ask .no:hover { background: #333; }
      .ask.danger .head { background: linear-gradient(135deg,#3f1d1d,#2a1414); }
      .ask .what { background: #2a2a2c; }
      .ask .amount { color: #f87171; }
    }
  `;

  // ---------- host ----------

  function ensureHost() {
    if (host) return;
    // z-index 顶格：ask 并进来之后这个 host 不再是纯装饰层——「需要确认」的
    // 浮条绝不能被页面自己的最高层弹窗盖住（支付确认被遮住=没有确认）。
    // 边框和光标跟着顶格没有代价，它们 pointer-events:none。
    host = document.createElement('div');
    host.style.cssText = 'all:initial;position:fixed;z-index:2147483647';
    const root = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = CSS;
    wrap = document.createElement('div');
    wrap.className = 'wrap';
    // 骨架是静态模板，动态内容全走 textContent（铁律 2）
    wrap.innerHTML = '<div class="edge t"></div><div class="edge b"></div>'
      + '<div class="edge l"></div><div class="edge r"></div>'
      + '<div class="cursor"><div class="glow"></div>'
      + '<svg width="26" height="26" viewBox="0 0 26 26">'
      + '<path d="M4 2 L4 21 L9 16.5 L12.5 24 L16 22.3 L12.5 15 L19 15 Z" fill="#fff" stroke="var(--c)" stroke-width="1.6" stroke-linejoin="round"/>'
      + '</svg></div>'
      // own 装入口小头像，ask 直接挂在 dock 下。分开是为了重画入口时
      // 不动 ask 节点——它有输入框，挪一下用户打了一半的字就丢焦点
      + '<div class="dock at-r"><div class="own"></div></div>';
    root.append(style, wrap);
    document.documentElement.appendChild(host);
    if (stealthed) host.style.visibility = 'hidden';
    watchContext();
  }

  // host 只在「既没有主、也没有挂着的 ask」时才拆——ask 是功能件不是装饰件，
  // 用户把标记开关关掉（收到 clear）时它必须还在。
  function maybeTeardown() {
    if (owners.length || askSettle) return;
    if (host) { host.remove(); host = null; wrap = null; }
    for (const s of actState.values()) clearTimeout(s.timer);
    actState.clear();
    if (placeTimer) { clearInterval(placeTimer); placeTimer = null; }
    if (dozeTimer) { clearTimeout(dozeTimer); dozeTimer = null; }
    cursorShown = false;
    if (watchdog) { clearInterval(watchdog); watchdog = null; }
  }

  // 扩展一旦被重载、更新或停用，这个页面里的脚本就永远收不到消息了
  // （chrome.runtime.id 变成 undefined，俗称 context invalidated）。
  // 没有这条自检，标记会永久钉在页面上：background 那边的记账在扩展重载时
  // 一起清空了，再没有任何人知道该来摘它。ask 同理——重载后 background 的
  // 轮询已经死了，浮条留着也永远没人收结果，一并拆掉。
  function watchContext() {
    if (watchdog) return;
    watchdog = setInterval(() => {
      if (chrome.runtime?.id) return;
      owners = [];
      if (askSettle) closeAsk('cancelled', '扩展已重载');
      askSettle = null;
      maybeTeardown();
    }, 5000);
  }

  // ---------- 边框 ----------

  // 一条边的底色。单主用实色；多主用 45° 双色条纹——「这页有两个主」
  // 是最该被一眼看出来的状态，它意味着两个 agent 正在同一个页面上互相踩。
  function edgePaint() {
    if (owners.length === 1) return owners[0].color;
    const stops = [];
    const w = 9;
    owners.forEach((o, i) => stops.push(`${o.color} ${i * w}px ${(i + 1) * w}px`));
    return `repeating-linear-gradient(45deg, ${stops.join(', ')})`;
  }

  // ---------- 入口小头像 ----------

  function render() {
    if (!TOP) return;
    if (!owners.length && !askSettle) return maybeTeardown();
    ensureHost();

    const paint = owners.length ? edgePaint() : '';
    wrap.querySelectorAll('.edge').forEach((e) => {
      e.style.background = paint;
      e.style.display = owners.length ? '' : 'none';
    });

    // 入口每条 set 消息整个重画。ask 节点不在这个区里，完全不被触碰。
    const own = wrap.querySelector('.own');
    own.textContent = '';
    if (owners.length) own.appendChild(buildPebble());

    place();
    if (owners.length && !placeTimer) placeTimer = setInterval(() => { if (!document.hidden) place(); }, 3000);
    if (!owners.length && placeTimer) { clearInterval(placeTimer); placeTimer = null; }

    syncCursorIdle();
  }

  function buildPebble() {
    const o = owners[0];
    const b = document.createElement('div');
    b.className = 'pebble';
    b.style.setProperty('--c', o.color);
    if ([...actState.keys()].some((sid) => owners.some((x) => x.sid === sid))) b.classList.add('act');
    const av = avatarCanvas(22); av.style.borderColor = o.color;
    b.appendChild(av);
    if (owners.length > 1) {
      const n = document.createElement('span'); n.className = 'n'; n.textContent = String(owners.length);
      b.appendChild(n);
    }
    // title 是浏览器原生提示，不进我们的层，也就不会再挡别的东西
    b.title = `${owners.map((x) => x.label).join('、')} 正在操作这一页${tabLabel ? `（${tabLabel}）` : ''}\n点一下在侧栏里看它在做什么`;
    b.addEventListener('click', () => {
      try {
        chrome.runtime.sendMessage({ __hcPanel: 'open' }).then((r) => {
          if (!r?.ok) hint('点浏览器工具栏的 agentchrome-mcp 图标，在侧栏里看它在做什么');
        }).catch(() => {});
      } catch { /* context 正在失效 */ }
    });
    return b;
  }

  // 侧栏打不开时（极少数 Chrome 版本不认内容脚本带来的手势）就地说一句去哪找
  function hint(text) {
    if (!wrap) return;
    const own = wrap.querySelector('.own');
    own.querySelector('.tip')?.remove();
    const t = document.createElement('div');
    t.className = 'tip';
    t.textContent = text;
    own.appendChild(t);
    setTimeout(() => t.remove(), 4000);
  }

  // ---------- 避位 ----------
  //
  // 候选停靠位，右下是默认（老用户的位置记忆），其余按「页面上最常空着」排。
  // 每个位置在头像将要占的范围里取 5 个点，看页面在那里是不是可交互的东西；
  // 选第一个完全干净的。当前位置干净就不挪——跳来跳去比偶尔压一下边更烦人。

  const SPOTS = [
    { k: 'br', side: 'r', at: () => ({ right: 16, bottom: 16 }) },
    { k: 'rm', side: 'r', at: () => ({ right: 16, top: Math.round(innerHeight / 2) }) },
    { k: 'bl', side: 'l', at: () => ({ left: 16, bottom: 16 }) },
    { k: 'tr', side: 'r', at: () => ({ right: 16, top: 72 }) },
  ];
  let spot = SPOTS[0];
  const PEB = 28;

  const INTERACTIVE = 'a[href],button,input,textarea,select,summary,label,[role=button],[role=link],'
    + '[role=textbox],[role=combobox],[role=tab],[role=menuitem],[role=checkbox],[role=switch],'
    + '[contenteditable=""],[contenteditable=true],[onclick],[tabindex]:not([tabindex="-1"])';

  // (x,y) 处页面自己最上层的元素是不是能点的。只看最上层那一个——被它盖住的
  // 东西用户本来也点不到。cursor:pointer 兜住了 div 做的按钮（豆包的发送键就是）。
  function interactiveAt(x, y) {
    if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return false;
    for (const el of document.elementsFromPoint(x, y)) {
      if (el === host) continue;
      if (el === document.documentElement || el === document.body) return false;
      if (el.closest(INTERACTIVE)) return true;
      try { return getComputedStyle(el).cursor === 'pointer'; } catch { return false; }
    }
    return false;
  }

  function rectOf(sp) {
    const a = sp.at();
    const left = a.left != null ? a.left : innerWidth - a.right - PEB;
    const top = a.top != null ? a.top : innerHeight - a.bottom - PEB;
    return { left, top, right: left + PEB, bottom: top + PEB };
  }

  function score(sp) {
    const r = rectOf(sp), m = 3;
    const pts = [[r.left + m, r.top + m], [r.right - m, r.top + m], [r.left + m, r.bottom - m],
      [r.right - m, r.bottom - m], [(r.left + r.right) / 2, (r.top + r.bottom) / 2]];
    return pts.filter(([x, y]) => interactiveAt(x, y)).length;
  }

  function place() {
    if (!wrap || !owners.length) return;
    let best = spot;
    if (score(spot) > 0) {
      let min = Infinity;
      for (const sp of SPOTS) {
        const sc = score(sp);
        if (sc < min) { min = sc; best = sp; }
        if (sc === 0) break;
      }
    }
    spot = best;
    const dock = wrap.querySelector('.dock');
    const a = spot.at();
    for (const k of ['left', 'right', 'top', 'bottom']) dock.style[k] = a[k] != null ? `${a[k]}px` : '';
    dock.classList.toggle('at-r', spot.side === 'r');
    dock.classList.toggle('at-l', spot.side === 'l');
  }

  addEventListener('resize', () => { if (wrap) place(); }, { passive: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && wrap) place(); });

  // 人手让路：只认真实的鼠标（isTrusted），agent 的合成事件不算。
  document.addEventListener('pointermove', (e) => {
    if (!e.isTrusted || !wrap || !owners.length) return;
    const peb = wrap.querySelector('.pebble');
    if (!peb) return;
    const r = peb.getBoundingClientRect();
    const near = e.clientX >= r.left - 6 && e.clientX <= r.right + 6 && e.clientY >= r.top - 6 && e.clientY <= r.bottom + 6;
    peb.classList.toggle('yield', near && interactiveAt(e.clientX, e.clientY));
  }, { capture: true, passive: true });

  // ---------- 虚拟光标 ----------
  //
  // content.js 与本文件同处一个 isolated world，动作坐标在那边解析元素时
  // 就地传过来（window.__hcCursor），零消息往返、零延迟。真实点击(L2)和
  // 合成点击(L1)都先过 locate，所以两条路的光标一致。
  //
  // 顺路兼任「让路」职责：坐标落在入口底下时把它瞬间变成 pointer-events:none。
  // 这必须在 content.js 做 elementFromPoint 遮挡检测**之前**同步生效——
  // 调用方保证先调本钩子再检测，这里保证 classList 同步改完才返回。

  let cursorShown = false, dozeTimer = null, dodgeTimer = null;
  let curX = 0, curY = 0;

  // 休眠时停在入口旁边，入口挪到哪它跟到哪
  const dozeSpot = () => {
    const r = rectOf(spot);
    return { x: spot.side === 'r' ? r.left - 18 : r.right + 6, y: spot.k === 'tr' ? r.bottom + 10 : r.top - 34 };
  };

  function moveCursor(x, y) {
    const c = wrap.querySelector('.cursor');
    curX = x; curY = y;
    c.style.transform = `translate(${x}px, ${y}px)`;
    return c;
  }

  function syncCursorIdle() {
    if (!wrap) return;
    const c = wrap.querySelector('.cursor');
    c.style.setProperty('--c', owners[0]?.color || '#a855f7');
    if (!owners.length) { c.classList.remove('on'); cursorShown = false; return; }
    // 有主但还没动过手：光标以休眠态停靠在入口旁——存在感有了，
    // 但不呼吸。呼吸要等第一个动作（铁律 3）。
    if (!cursorShown) {
      const p = dozeSpot();
      c.classList.add('on', 'doze');
      moveCursor(p.x, p.y);
      cursorShown = true;
    }
  }

  function dodgeIfOver(x, y) {
    const dock = wrap.querySelector('.dock');
    const r = dock.getBoundingClientRect();
    if (!r.width || x < r.left - 8 || x > r.right + 8 || y < r.top - 8 || y > r.bottom + 8) return;
    dock.classList.add('dodge');
    clearTimeout(dodgeTimer);
    dodgeTimer = setTimeout(() => wrap && dock.classList.remove('dodge'), 1600);
  }

  window.__hcCursor = (x, y, kind) => {
    if (!TOP || !wrap || !owners.length) return;
    const c = wrap.querySelector('.cursor');
    c.classList.add('on');
    c.classList.remove('doze');

    if (x != null && y != null) {
      dodgeIfOver(x, y);
      moveCursor(x, y);
    }
    if (kind === 'click') {
      // 涟漪等滑行到位再放，否则爆点在起点。时长对齐 transition(240ms)。
      setTimeout(() => {
        if (!wrap) return;
        const ring = document.createElement('span');
        ring.className = 'ring';
        ring.addEventListener('animationend', () => ring.remove());
        c.appendChild(ring);
      }, 240);
    } else if (kind === 'type') {
      c.classList.add('typing');
      setTimeout(() => wrap && c.classList.remove('typing'), 900);
    } else if (kind === 'key') {
      c.classList.add('pressed');
      setTimeout(() => wrap && c.classList.remove('pressed'), 200);
    } else if (kind === 'scroll') {
      c.classList.remove('bob');
      void c.offsetWidth;   // 重启动画
      c.classList.add('bob');
    }

    // 30 秒没有新动作就休眠归位。每个动作重新计时。
    clearTimeout(dozeTimer);
    dozeTimer = setTimeout(() => {
      if (!wrap) return;
      const p = dozeSpot();
      c.classList.add('doze');
      moveCursor(p.x, p.y);
    }, 30000);
  };

  // ---------- ask：人工介入 ----------
  //
  // 从 ask-overlay.js 原样并入，协议不变（show/poll/flash/abort）。
  // 结果靠 background 轮询取，不攥着 sendResponse 等几分钟——页面一旦进
  // back/forward cache 消息通道当场关闭，长回调那版真实撞死过。

  let askEl = null;
  let askSettle = null;   // 当前这一轮的结算标志
  let askOutcome = null;  // 已结算的结果，等 background 来取
  let askTimer = null;

  function closeAsk(result, note) {
    if (askEl) { askEl.remove(); askEl = null; }
    if (askTimer) { clearInterval(askTimer); askTimer = null; }
    askSettle = null;
    askOutcome = { outcome: result, note: note || '' };
    maybeTeardown();
  }

  function showAsk(msg) {
    ensureHost();
    // 上一轮还开着就先结算掉，否则两个浮条叠在一起，旧的永远没人回应
    if (askSettle) closeAsk('cancelled', '被新的请求取代');
    askOutcome = null;
    askSettle = true;

    askEl = document.createElement('div');
    askEl.className = 'ask';
    askEl.innerHTML = `
      <div class="head"><span class="dot"></span><span class="t"></span></div>
      <div class="body"><span class="p"></span></div>
      <div class="foot">
        <span class="clock"></span>
        <button class="no">取消</button>
        <button class="ok">我完成了</button>
      </div>`;
    // 文案一律走 textContent，绝不拼进 innerHTML——prompt 是从 agent 那边传过来的，
    // 而 agent 的内容可能源自页面（也就是可能被注入）。这里是最后一道
    // 「数据不当代码用」的边界。
    askEl.querySelector('.head').prepend(avatarCanvas(20));   // 是agentchrome的分身在请你搭把手
    askEl.querySelector('.t').textContent = msg.title || 'agentchrome-mcp 需要你搭把手';
    askEl.querySelector('.p').textContent = msg.prompt || '';
    if (msg.danger) askEl.classList.add('danger');
    if (msg.okText) askEl.querySelector('.ok').textContent = msg.okText;
    if (msg.noText) askEl.querySelector('.no').textContent = msg.noText;
    // 「点哪个按钮、在哪个站、多少钱」单独拎出来，不混在正文里。
    // 正文是 agent 写的（可能源自被注入的页面），这几样是扩展自己看到的事实。
    if (msg.facts) {
      const box = document.createElement('div');
      box.className = 'what';
      for (const [k, v] of msg.facts) {
        if (!v) continue;
        const line = document.createElement('div');
        const key = document.createElement('span');
        key.textContent = `${k}：`;
        const val = document.createElement('span');
        val.textContent = v;
        if (k === '金额') val.className = 'amount';
        line.append(key, val);
        box.appendChild(line);
      }
      askEl.querySelector('.body').appendChild(box);
    }

    let noteEl = null;
    if (msg.wantNote) {
      noteEl = document.createElement('textarea');
      noteEl.className = 'note';
      noteEl.placeholder = '（可选）想对 agent 说的话';
      askEl.querySelector('.body').appendChild(noteEl);
    }

    askEl.querySelector('.ok').addEventListener('click', () => closeAsk('continued', noteEl?.value));
    askEl.querySelector('.no').addEventListener('click', () => closeAsk('cancelled', noteEl?.value));

    // 挂在 own 之外：会话区重画时不触碰 ask（输入框的焦点经不起挪动）
    wrap.querySelector('.dock').appendChild(askEl);

    // 倒计时。不显示的话用户不知道自己还有多久，而超时后 agent 那边已经走了，
    // 他还在慢慢操作——两边对不上。
    const deadline = Date.now() + (msg.timeout || 300000);
    const clock = askEl.querySelector('.clock');
    askTimer = setInterval(() => {
      const left = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      clock.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
      if (left <= 0) closeAsk('timed_out', noteEl?.value);
    }, 500);
  }

  // 高亮：把用户的视线直接送到该操作的地方，省掉「在哪儿？」这一步。
  // 描边画在覆盖层上而不是改元素自己的 style——后者会污染页面，
  // 而且遇到 overflow:hidden 的容器会被裁掉。
  function flashTargets(els) {
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) continue;
      const ring = document.createElement('div');
      ring.style.cssText = `position:fixed;left:${r.left - 4}px;top:${r.top - 4}px;`
        + `width:${r.width + 8}px;height:${r.height + 8}px;border:2px solid #f97316;`
        + `border-radius:8px;pointer-events:none;z-index:2147483646;`
        + `box-shadow:0 0 0 9999px rgba(0,0,0,.04);transition:opacity .3s`;
      document.documentElement.appendChild(ring);
      let n = 0;
      const blink = setInterval(() => {
        ring.style.opacity = (++n % 2) ? '0.25' : '1';
        if (n > 7) { clearInterval(blink); ring.remove(); }
      }, 300);
    }
  }

  // ---------- 幕帘 ----------
  //
  // 光标、边框、入口、ask 全会被 agent 自己的 screenshot 拍进去——它会看到
  // 一个页面上并不存在的发光箭头，把它当页面元素去理解甚至去点。所以 background
  // 在截图前拉幕帘、拍完放下。样式改动在 sendMessage 的应答路径里同步生效，
  // ack 返回时 visibility 已应用；两条截图路径都是 ack 之后才合成新帧。

  let stealthed = false;
  function setStealth(on) {
    stealthed = !!on;
    if (host) host.style.visibility = stealthed ? 'hidden' : '';
  }

  // ---------- 消息 ----------

  // agent 刚刚做了什么。入口的色环扩散（记完在下一次 render 里出现），
  // 5 秒没有新动作就停。
  function recordAct(sid, text) {
    const prev = actState.get(sid);
    if (prev) clearTimeout(prev.timer);
    actState.set(sid, {
      text: String(text).slice(0, 40),
      timer: setTimeout(() => { actState.delete(sid); if (owners.length) render(); }, 5000),
    });
  }

  // 边框亮一下——常驻的淡边框回答「有没有主」，这一下回答「它此刻在动」。
  // 两个问题都要有答案，否则用户看着一个静止的页面无从判断。
  function flashEdges() {
    if (!wrap) return;
    wrap.classList.add('lit');
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => wrap?.classList.remove('lit'), 420);
  }

  chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
    if (msg && msg.__hcMark !== undefined) {
      // 非顶层框架照样要应答 ping，否则 background 会以为脚本没注入，
      // 于是每条命令都重注一次
      if (msg.__hcMark === 'ping') { sendResponse({ pong: true, top: TOP }); return true; }
      if (msg.__hcMark === 'set') {
        // logs / intents / plan 归侧栏展示（background 另存一份给它），页内只用归属和动作
        tabLabel = typeof msg.tabLabel === 'string' ? msg.tabLabel : '';
        owners = Array.isArray(msg.owners) ? msg.owners.filter((o) => o && o.sid) : [];
        // 先记动作再画：act 的高亮状态要出现在这一次渲染里，分开就是两次渲染
        if (msg.act && msg.sid) recordAct(msg.sid, msg.act);
        if (TOP) { render(); if (msg.act) flashEdges(); }
        sendResponse({ ok: true });
        return true;
      }
      // clear 走完整 render 而不是直接 teardown：ask 还挂着时 host 必须留下，
      // 但边框/胶囊/标题这些「存在感」要立刻消失——直接拆会因 ask 在场而早退，
      // 留一屏已经没主的标记
      if (msg.__hcMark === 'clear') { owners = []; render(); sendResponse({ ok: true }); return true; }
      if (msg.__hcMark === 'stealth') { setStealth(msg.on); sendResponse({ ok: true }); return true; }
      return;
    }
    if (msg && msg.__hcAsk !== undefined) {
      // show 立即返回，不攥着 sendResponse 等人——见 closeAsk 上面那段
      if (msg.__hcAsk === 'show') { showAsk(msg); sendResponse({ shown: true }); return true; }
      if (msg.__hcAsk === 'poll') { sendResponse(askOutcome || { pending: true }); return true; }
      if (msg.__hcAsk === 'flash') {
        const els = (msg.selectors || []).map((s) => {
          try { return document.querySelector(s); } catch { return null; }
        }).filter(Boolean);
        if (els[0]) els[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
        flashTargets(els);
        sendResponse({ matched: els.length });
        return true;
      }
      if (msg.__hcAsk === 'abort') { closeAsk('cancelled', '被 agent 取消'); sendResponse({ ok: true }); return true; }
    }
  });

})();
