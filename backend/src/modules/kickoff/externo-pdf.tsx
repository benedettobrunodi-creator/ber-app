import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import * as React from "react";
import type { KickoffExternoConteudo, ItemKE, PessoaKE, BlocoTecnicoKE } from "./externo-template";

// PDF do Kickoff EXTERNO = o MESMO deck do PPT, em PDF (Bruno 10/09/26):
// páginas 16:9 (960×540pt), fundo carvão, oliva, um "slide" por página.

const CARVAO = "#1E1E22";
const CARD = "#26262B";
const OLIVA = "#B5B820";
const BRANCO = "#F4F4F2";
const CINZA = "#9A9C90";
const LINHA = "#3A3A40";

const s = StyleSheet.create({
  page: { backgroundColor: CARVAO, color: BRANCO, paddingTop: 34, paddingHorizontal: 40, paddingBottom: 36 },
  headTxt: { position: "absolute", top: 20, left: 40, fontSize: 7, color: CINZA, letterSpacing: 2.5 },
  headNum: { position: "absolute", top: 20, right: 40, fontSize: 7, color: OLIVA, fontWeight: 700 },
  headLine: { position: "absolute", top: 42, left: 40, right: 40, borderBottomWidth: 0.75, borderBottomColor: LINHA },
  foot: { position: "absolute", bottom: 18, left: 40, fontSize: 6, color: CINZA, letterSpacing: 2.5 },
  titulo: { fontSize: 26, fontWeight: 700, marginTop: 28 },
  tituloBarra: { width: 58, borderBottomWidth: 2.5, borderBottomColor: OLIVA, marginTop: 8, marginBottom: 14 },
  capaTitulo: { fontSize: 44, fontWeight: 700, marginTop: 130 },
  capaSub: { fontSize: 24, color: OLIVA, fontWeight: 700, marginTop: 8 },
  capaInfo: { fontSize: 11, color: CINZA, marginTop: 12 },
  itemNum: { fontSize: 12, color: OLIVA, fontWeight: 700, width: 26 },
  itemTitulo: { fontSize: 11, fontWeight: 700, letterSpacing: 0.5 },
  itemDesc: { fontSize: 9, color: CINZA, marginTop: 2, lineHeight: 1.4 },
  rotulo: { fontSize: 8, color: CINZA, fontWeight: 700, letterSpacing: 1.8 },
  rotuloOliva: { fontSize: 8, color: OLIVA, fontWeight: 700, letterSpacing: 1.8 },
  card: { backgroundColor: CARD, borderWidth: 0.75, borderColor: LINHA, borderRadius: 4, padding: 8, marginBottom: 8 },
  texto: { fontSize: 13, lineHeight: 1.7, color: BRANCO },
});

const PAGE_SIZE: [number, number] = [960, 540];

function Slide({ num, cliente, children }: { num: number; cliente: string; children: React.ReactNode }) {
  return (
    <Page size={PAGE_SIZE} style={s.page}>
      <Text style={s.headTxt}>REUNIÃO KICK OFF · {cliente.toUpperCase()}</Text>
      <Text style={s.headNum}>{String(num).padStart(2, "0")}</Text>
      <View style={s.headLine} />
      {children}
      <Text style={s.foot} fixed>BÈR ENGENHARIA  ·  SÃO PAULO</Text>
    </Page>
  );
}

const Titulo = ({ t }: { t: string }) => (
  <View>
    <Text style={s.titulo}>{t}</Text>
    <View style={s.tituloBarra} />
  </View>
);

const Itens = ({ itens, intro }: { itens: ItemKE[]; intro?: string | null }) => (
  <View>
    {intro ? <Text style={[s.itemDesc, { fontSize: 10.5, marginBottom: 10 }]}>{intro}</Text> : null}
    {itens.map((it, i) => (
      <View key={i} style={{ flexDirection: "row", marginBottom: 11 }}>
        <Text style={s.itemNum}>{String(i + 1).padStart(2, "0")}</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.itemTitulo}>{it.titulo.toUpperCase()}</Text>
          {it.descricao ? <Text style={s.itemDesc}>{it.descricao}</Text> : null}
        </View>
      </View>
    ))}
  </View>
);

const Pessoas = ({ rotulo, lista, largura }: { rotulo: string; lista: PessoaKE[]; largura: string }) => (
  <View style={{ width: largura, paddingRight: 10 }}>
    <Text style={[s.rotulo, { marginBottom: 6 }]}>{rotulo.toUpperCase()}</Text>
    {lista.map((p, i) => (
      <View key={i} style={s.card}>
        <Text style={s.rotuloOliva}>{p.papel.toUpperCase()}</Text>
        <Text style={{ fontSize: 10.5, fontWeight: 700, marginTop: 2 }}>{p.nome || "—"}</Text>
        {p.contato ? <Text style={{ fontSize: 7.5, color: CINZA, marginTop: 1 }}>{p.contato}</Text> : null}
      </View>
    ))}
  </View>
);

export function KickoffExternoPDF({ obra, c, geradoEm }: {
  obra: { name: string; address: string | null };
  c: KickoffExternoConteudo;
  geradoEm: Date;
}) {
  const cliente = c.nomeCliente || obra.name;
  const dataFmt = (c.dataReuniao
    ? new Date(c.dataReuniao + "T12:00:00")
    : geradoEm
  ).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });

  let num = 0;
  const n = () => ++num;

  const pauta: string[] = [];
  if (c.time.ativo) pauta.push("Apresentação do time");
  if (c.escopo.ativo) pauta.push("Escopo de trabalho");
  if (c.responsabilidades.ativo) pauta.push("Responsabilidades");
  if (c.aprovacoes.ativo) pauta.push("Aprovações e decisões");
  if (c.comunicacao.ativo) pauta.push("Fluxo de comunicação");
  if (c.projetosAprovacoes.ativo) pauta.push("Projetos — aprovações");
  if (c.periodoObras.ativo) pauta.push("Período de obras");
  if (c.registros.ativo) pauta.push("Registros e documentos de obra");
  if (c.logistica.ativo) pauta.push("Logística e estacionamento");
  if (c.tecnicos.ativo) pauta.push("Assuntos técnicos de obra");
  if (c.condominio.ativo) pauta.push("Interface com o condomínio");

  const blocosTecnicos: BlocoTecnicoKE[] = c.tecnicos.ativo ? c.tecnicos.blocos.filter((b) => b.topicos.length) : [];

  return (
    <Document title={`Kickoff ${cliente} — BÈR`} author="BÈR Engenharia">
      <Slide num={n()} cliente={cliente}>
        <Text style={s.capaTitulo}>Kick off.</Text>
        <Text style={s.capaSub}>Projeto {cliente}.</Text>
        {obra.address ? <Text style={s.capaInfo}>{obra.address}</Text> : null}
        <Text style={s.capaInfo}>{dataFmt}</Text>
      </Slide>

      <Slide num={n()} cliente={cliente}>
        <Titulo t="Pauta." />
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {pauta.map((p, i) => (
            <View key={i} style={{ width: "50%", flexDirection: "row", marginBottom: 13 }}>
              <Text style={s.itemNum}>{String(i + 1).padStart(2, "0")}</Text>
              <Text style={{ fontSize: 12 }}>{p}</Text>
            </View>
          ))}
        </View>
      </Slide>

      {c.time.ativo && (
        <Slide num={n()} cliente={cliente}>
          <Titulo t="Time." />
          <View style={{ flexDirection: "row" }}>
            <Pessoas rotulo="Lado BÈR" lista={c.time.ladoBer} largura="40%" />
            <Pessoas rotulo="Back office" lista={c.time.backOffice} largura="30%" />
            <Pessoas rotulo={`Lado ${cliente}`} lista={c.time.ladoCliente} largura="30%" />
          </View>
        </Slide>
      )}

      {c.escopo.ativo && c.escopo.texto.trim() ? (
        <Slide num={n()} cliente={cliente}>
          <Titulo t="Escopo de trabalho." />
          <Text style={[s.texto, { maxWidth: 760 }]}>{c.escopo.texto}</Text>
        </Slide>
      ) : null}

      {c.responsabilidades.ativo && (
        <Slide num={n()} cliente={cliente}>
          <Titulo t="Responsabilidades." />
          <View style={{ flexDirection: "row" }}>
            <View style={{ width: "50%", paddingRight: 20 }}>
              <Text style={[s.rotuloOliva, { marginBottom: 8 }]}>LADO {cliente.toUpperCase()}</Text>
              {c.responsabilidades.cliente.map((t, i) => (
                <Text key={i} style={{ fontSize: 11, marginBottom: 7 }}>—   {t}</Text>
              ))}
            </View>
            <View style={{ width: "50%" }}>
              <Text style={[s.rotuloOliva, { marginBottom: 8 }]}>LADO BÈR</Text>
              {c.responsabilidades.ber.map((t, i) => (
                <Text key={i} style={{ fontSize: 11, marginBottom: 7 }}>—   {t}</Text>
              ))}
            </View>
          </View>
        </Slide>
      )}

      {c.aprovacoes.ativo && c.aprovacoes.itens.length > 0 && (
        <Slide num={n()} cliente={cliente}>
          <Titulo t="Aprovações e decisões." />
          <Itens itens={c.aprovacoes.itens} intro={c.aprovacoes.intro} />
        </Slide>
      )}

      {c.comunicacao.ativo && c.comunicacao.blocos.length > 0 && (
        <Slide num={n()} cliente={cliente}>
          <Titulo t="Fluxo de comunicação." />
          <Itens itens={c.comunicacao.blocos} />
        </Slide>
      )}

      {c.projetosAprovacoes.ativo && c.projetosAprovacoes.etapas.length > 0 && (
        <Slide num={n()} cliente={cliente}>
          <Titulo t="Projetos — aprovações." />
          <Itens itens={c.projetosAprovacoes.etapas} />
        </Slide>
      )}

      {c.periodoObras.ativo && (
        <Slide num={n()} cliente={cliente}>
          <Titulo t="Período de obras." />
          <Text style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{c.periodoObras.texto}</Text>
          <Text style={{ fontSize: 12, color: CINZA, marginTop: 8 }}>{c.periodoObras.observacao}</Text>
        </Slide>
      )}

      {c.registros.ativo && c.registros.blocos.length > 0 && (
        <Slide num={n()} cliente={cliente}>
          <Titulo t="Registros e documentos de obra." />
          <Itens itens={c.registros.blocos} />
        </Slide>
      )}

      {c.logistica.ativo && (
        <Slide num={n()} cliente={cliente}>
          <Titulo t={`${c.logistica.titulo}.`} />
          <Text style={[s.texto, { maxWidth: 760 }]}>{c.logistica.texto}</Text>
        </Slide>
      )}

      {c.tecnicos.ativo && c.tecnicos.blocos.length > 0 && (
        <Slide num={n()} cliente={cliente}>
          <Titulo t="Assuntos técnicos de obra." />
          <Itens itens={c.tecnicos.blocos.map((b) => ({ titulo: b.titulo, descricao: "" }))} />
        </Slide>
      )}

      {blocosTecnicos.map((bloco, bi) => (
        <Slide key={bi} num={n()} cliente={cliente}>
          <Titulo t={`${bloco.titulo}.`} />
          {bloco.topicos.map((t, i) => (
            <View key={i} style={{ marginBottom: 12 }}>
              <Text style={s.rotuloOliva}>{t.titulo.toUpperCase()}</Text>
              <Text style={[s.itemDesc, { fontSize: 10, color: BRANCO, marginTop: 3 }]}>{t.descricao}</Text>
            </View>
          ))}
        </Slide>
      ))}

      {c.condominio.ativo && c.condominio.texto.trim() ? (
        <Slide num={n()} cliente={cliente}>
          <Titulo t="Interface com o condomínio." />
          <Text style={[s.texto, { maxWidth: 760 }]}>{c.condominio.texto}</Text>
        </Slide>
      ) : null}

      <Slide num={n()} cliente={cliente}>
        <Text style={{ fontSize: 38, fontWeight: 700, color: OLIVA, textAlign: "center", marginTop: 200 }}>
          {c.encerramento || "Let's Move Forward!"}
        </Text>
      </Slide>
    </Document>
  );
}
