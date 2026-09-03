// Tutorial de envio de NF pelo app BÈR — gera PDF pra circular com o time.
// Uso: cd ~/ber-app/backend && npx tsx ~/.claude/agents/linux/scratch/tutorial_nf_pdf.tsx
import * as React from 'react';
import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import { writeFileSync } from 'node:fs';

const C = {
  carbon: '#1E2432',
  ink: '#2D2D2D',
  gray: '#868686',
  border: '#E8E8E4',
  offwhite: '#F7F7F5',
  olive: '#7A8450',
  teal: '#5A7A7A',
  amber: '#B45309',
};

const s = StyleSheet.create({
  page: { padding: 48, fontSize: 10.5, color: C.ink, fontFamily: 'Helvetica', lineHeight: 1.5 },
  header: { backgroundColor: C.carbon, color: '#fff', padding: 16, borderRadius: 6, marginBottom: 6 },
  brand: { fontSize: 13, letterSpacing: 3, fontFamily: 'Helvetica-Bold' },
  headerSub: { color: '#C9CDD6', fontSize: 9, marginTop: 3 },
  title: { fontSize: 17, fontFamily: 'Helvetica-Bold', color: C.carbon, marginTop: 18, marginBottom: 4 },
  intro: { color: C.gray, marginBottom: 14 },
  step: { flexDirection: 'row', marginBottom: 12 },
  stepNumWrap: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: C.carbon,
    alignItems: 'center', justifyContent: 'center', marginRight: 10, marginTop: 1,
  },
  stepNum: { color: '#fff', fontSize: 11, fontFamily: 'Helvetica-Bold' },
  stepBody: { flex: 1 },
  stepTitle: { fontFamily: 'Helvetica-Bold', fontSize: 11.5, color: C.carbon, marginBottom: 2 },
  stepText: { color: C.ink },
  hint: { color: C.gray, fontSize: 9.5, marginTop: 2 },
  box: { backgroundColor: C.offwhite, borderWidth: 1, borderColor: C.border, borderRadius: 6, padding: 12, marginTop: 6, marginBottom: 14 },
  boxTitle: { fontFamily: 'Helvetica-Bold', fontSize: 10.5, color: C.carbon, marginBottom: 4 },
  bullet: { flexDirection: 'row', marginBottom: 3 },
  bulletDot: { width: 12, color: C.olive, fontFamily: 'Helvetica-Bold' },
  bulletText: { flex: 1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  statusName: { fontFamily: 'Helvetica-Bold', width: 70 },
  footer: { position: 'absolute', bottom: 30, left: 48, right: 48, color: C.gray, fontSize: 8.5, textAlign: 'center' },
  shotWide: { width: '100%', borderRadius: 6, borderWidth: 1, borderColor: C.border, marginTop: 4, marginBottom: 14 },
  shotRow: { flexDirection: 'row', gap: 14, marginBottom: 12 },
  shotCol: { flex: 1 },
  shotPhone: { width: 170, borderRadius: 6, borderWidth: 1, borderColor: C.border, alignSelf: 'flex-start' },
  shotCaption: { color: C.gray, fontSize: 8.5, marginTop: 3, width: 170, textAlign: 'center' },
});

function Step({ n, title, children, hint }: { n: string; title: string; children: React.ReactNode; hint?: string }) {
  return (
    <View style={s.step} wrap={false}>
      <View style={s.stepNumWrap}><Text style={s.stepNum}>{n}</Text></View>
      <View style={s.stepBody}>
        <Text style={s.stepTitle}>{title}</Text>
        <Text style={s.stepText}>{children}</Text>
        {hint ? <Text style={s.hint}>{hint}</Text> : null}
      </View>
    </View>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={s.bullet}>
      <Text style={s.bulletDot}>•</Text>
      <Text style={s.bulletText}>{children}</Text>
    </View>
  );
}

const Doc = () => (
  <Document title="BÈR — Como enviar sua Nota Fiscal" author="BÈR Engenharia">
    <Page size="A4" style={s.page}>
      <View style={s.header}>
        <Text style={s.brand}>BÈR ENGENHARIA</Text>
        <Text style={s.headerSub}>Gestão de Folha · Minhas NFs</Text>
      </View>

      <Text style={s.title}>Como enviar sua Nota Fiscal pelo app</Text>
      <Text style={s.intro}>
        Todo mês, depois que o financeiro fecha a competência, você emite sua NF no valor combinado
        e envia pelo app BÈR. Leva menos de 2 minutos. Passo a passo:
      </Text>

      <Step n="1" title="Aguarde o e-mail de liberação"
        hint="Sem esse e-mail, a tela fica bloqueada com o aviso 'Aguardando fechamento do mês'.">
        No início do mês você recebe um e-mail do sistema BÈR avisando que a competência foi fechada
        e que o envio da NF está liberado. Quem trabalha em obra recebe junto o resumo das horas.
      </Step>

      <Step n="2" title="Emita sua Nota Fiscal"
        hint="Dúvida sobre o valor? Fale com o financeiro ANTES de emitir.">
        Emita a NF no valor combinado, pela prefeitura ou pelo seu emissor de costume, e salve o
        arquivo (PDF ou XML) no celular ou computador.
      </Step>

      <Step n="3" title="Abra o app BÈR e vá em Minhas NFs">
        Acesse ber-app.vercel.app com seu login. Entre em Apontamento de Horas (ou Gestão de Folha)
        e clique na aba "Minhas NFs", no topo da tela:
      </Step>
      <Image src="/tmp/nf_shot_tabs_wide.png" style={s.shotWide} />

      <View style={s.shotRow} wrap={false}>
        <View style={s.shotCol}>
          <Step n="4" title="Confira a competência (mês)"
            hint="A competência é o mês TRABALHADO, não o mês em que você está enviando.">
            O seletor de mês já vem no mês anterior — que normalmente é o mês da NF. Só mude se for
            enviar nota de outra competência.
          </Step>

          <Step n="5" title="Preencha e anexe">
            Informe o número da NF, o valor (igual ao da nota) e anexe o arquivo PDF ou XML.
            Observações são opcionais. Clique em "Enviar NF".
          </Step>

          <Step n="6" title="Acompanhe o status na mesma tela">
            Depois do envio, o financeiro valida a nota e marca o pagamento. O status aparece na
            própria tela Minhas NFs, sem precisar perguntar.
          </Step>
        </View>
        <View>
          <Image src="/tmp/nf_form_crop.png" style={s.shotPhone} />
          <Text style={s.shotCaption}>A tela de envio no celular</Text>
        </View>
      </View>

      <View style={s.box}>
        <Text style={s.boxTitle}>O que significa cada status</Text>
        <View style={s.statusRow}><Text style={{ ...s.statusName, color: C.amber }}>Enviada</Text><Text>chegou pro financeiro, aguardando validação.</Text></View>
        <View style={s.statusRow}><Text style={{ ...s.statusName, color: C.teal }}>Validada</Text><Text>nota conferida, pagamento em andamento.</Text></View>
        <View style={s.statusRow}><Text style={{ ...s.statusName, color: C.olive }}>Paga</Text><Text>pagamento concluído.</Text></View>
        <View style={s.statusRow}><Text style={{ ...s.statusName, color: '#B91C1C' }}>Rejeitada</Text><Text>algo não bateu — o motivo aparece na tela. Corrija e reenvie.</Text></View>
      </View>

      <View style={{ ...s.box, flexDirection: 'row', gap: 14 }}>
        <View style={{ flex: 1 }}>
        <Text style={s.boxTitle}>Dúvidas comuns</Text>
        <Bullet>"A tela diz que aguarda o fechamento do mês" — o financeiro ainda não fechou a competência. Aguarde o e-mail de liberação.</Bullet>
        <Bullet>"Aparece que meu cadastro não é PJ" — fale com o financeiro pra ajustar seu cadastro.</Bullet>
        <Bullet>"Errei o valor ou o arquivo" — enquanto a nota não for validada, é só reenviar na mesma tela que substitui. Se já foi validada ou paga, fale com o financeiro.</Bullet>
        <Bullet>Trabalha no escritório e não bate ponto em obra? O envio funciona igual — mesma tela, mesmos passos.</Bullet>
        </View>
        <View>
          <Image src="/tmp/nf_lock_crop.png" style={{ ...s.shotPhone, width: 140 }} />
          <Text style={{ ...s.shotCaption, width: 140 }}>Antes do fechamento, a tela fica assim</Text>
        </View>
      </View>

      <Text style={s.footer}>BÈR Engenharia · Excelência Operacional — dúvidas: financeiro@ber-engenharia.com.br</Text>
    </Page>
  </Document>
);

async function main() {
  const buf = await renderToBuffer(React.createElement(Doc) as never);
  const out = '/tmp/BER-Tutorial-Envio-de-NF.pdf';
  writeFileSync(out, buf);
  console.log(`OK ${out} ${buf.length} bytes`);
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
