import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import * as React from "react";
import type { KickoffExternoConteudo, ItemKE, PessoaKE } from "./externo-template";

// PDF do Kickoff EXTERNO — versão documento do deck (paleta institucional BÈR).

const CARVAO = "#1E1E22";
const OLIVA = "#B5B820";
const OLIVA_ESC = "#5E6B0F";
const CINZA = "#8B8D82";
const CREME = "#F7F7F5";
const LINHA = "#E4E6DA";

const s = StyleSheet.create({
  page: { backgroundColor: "#FFFFFF", color: CARVAO, fontSize: 10, paddingTop: 42, paddingBottom: 54, paddingHorizontal: 46 },
  faixa: { position: "absolute", top: 0, left: 0, right: 0, height: 6, backgroundColor: OLIVA },
  header: { fontSize: 8, color: CINZA, letterSpacing: 2, marginBottom: 4 },
  capaTitulo: { fontSize: 34, fontWeight: 700, marginTop: 130 },
  capaSub: { fontSize: 20, color: OLIVA_ESC, fontWeight: 700, marginTop: 6 },
  capaInfo: { fontSize: 11, color: CINZA, marginTop: 14 },
  sec: { fontSize: 9, fontWeight: 700, letterSpacing: 2, color: OLIVA_ESC, textTransform: "uppercase", marginTop: 20, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: LINHA },
  texto: { fontSize: 10.5, lineHeight: 1.6, color: "#3A3A3A" },
  itemTitulo: { fontSize: 10, fontWeight: 700, marginTop: 6 },
  itemDesc: { fontSize: 9.5, color: "#555750", lineHeight: 1.5 },
  num: { color: OLIVA_ESC, fontWeight: 700 },
  pessoaCard: { width: "31%", backgroundColor: CREME, borderWidth: 1, borderColor: LINHA, borderRadius: 4, padding: 7, marginRight: 8, marginBottom: 8 },
  papel: { fontSize: 6.5, fontWeight: 700, letterSpacing: 1, color: OLIVA_ESC, textTransform: "uppercase" },
  nome: { fontSize: 9.5, fontWeight: 700, marginTop: 2 },
  contato: { fontSize: 7.5, color: CINZA, marginTop: 1 },
  footer: { position: "absolute", bottom: 22, left: 46, right: 46, fontSize: 7.5, color: CINZA, flexDirection: "row", justifyContent: "space-between" },
});

const Rodape = ({ cliente }: { cliente: string }) => (
  <View style={s.footer} fixed>
    <Text>BÈR ENGENHARIA · SÃO PAULO</Text>
    <Text>Kickoff · {cliente}</Text>
  </View>
);

const Pessoas = ({ titulo, lista }: { titulo: string; lista: PessoaKE[] }) => (
  <View wrap={false}>
    <Text style={[s.itemTitulo, { color: CINZA, fontSize: 8, letterSpacing: 1.5 }]}>{titulo.toUpperCase()}</Text>
    <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 5 }}>
      {lista.map((p, i) => (
        <View key={i} style={s.pessoaCard}>
          <Text style={s.papel}>{p.papel}</Text>
          <Text style={s.nome}>{p.nome || "—"}</Text>
          {p.contato ? <Text style={s.contato}>{p.contato}</Text> : null}
        </View>
      ))}
    </View>
  </View>
);

const Itens = ({ itens }: { itens: ItemKE[] }) => (
  <View>
    {itens.map((it, i) => (
      <View key={i} wrap={false}>
        <Text style={s.itemTitulo}>
          <Text style={s.num}>{String(i + 1).padStart(2, "0")}  </Text>
          {it.titulo}
        </Text>
        {it.descricao ? <Text style={s.itemDesc}>{it.descricao}</Text> : null}
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
  const dataFmt = c.dataReuniao
    ? new Date(c.dataReuniao + "T12:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })
    : geradoEm.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });

  return (
    <Document title={`Kickoff ${cliente} — BÈR`} author="BÈR Engenharia">
      {/* capa */}
      <Page size="A4" style={s.page}>
        <View style={s.faixa} fixed />
        <Text style={s.header}>BÈR ENGENHARIA · REUNIÃO DE KICKOFF</Text>
        <Text style={s.capaTitulo}>Kick off.</Text>
        <Text style={s.capaSub}>Projeto {cliente}.</Text>
        {obra.address ? <Text style={s.capaInfo}>{obra.address}</Text> : null}
        <Text style={s.capaInfo}>{dataFmt}</Text>
        <Rodape cliente={cliente} />
      </Page>

      <Page size="A4" style={s.page}>
        <View style={s.faixa} fixed />

        {c.time.ativo && (
          <View>
            <Text style={s.sec}>Time</Text>
            <Pessoas titulo="Lado BÈR" lista={c.time.ladoBer} />
            {c.time.backOffice.length > 0 && <Pessoas titulo="Back office" lista={c.time.backOffice} />}
            {c.time.ladoCliente.length > 0 && <Pessoas titulo={`Lado ${cliente}`} lista={c.time.ladoCliente} />}
          </View>
        )}

        {c.escopo.ativo && c.escopo.texto.trim() ? (
          <View>
            <Text style={s.sec}>Escopo de trabalho</Text>
            <Text style={s.texto}>{c.escopo.texto}</Text>
          </View>
        ) : null}

        {c.responsabilidades.ativo && (
          <View>
            <Text style={s.sec}>Responsabilidades</Text>
            <View style={{ flexDirection: "row", gap: 18 }}>
              <View style={{ flex: 1 }}>
                <Text style={[s.papel, { fontSize: 7.5 }]}>LADO {cliente.toUpperCase()}</Text>
                {c.responsabilidades.cliente.map((t, i) => <Text key={i} style={s.itemDesc}>—  {t}</Text>)}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.papel, { fontSize: 7.5 }]}>LADO BÈR</Text>
                {c.responsabilidades.ber.map((t, i) => <Text key={i} style={s.itemDesc}>—  {t}</Text>)}
              </View>
            </View>
          </View>
        )}

        {c.aprovacoes.ativo && c.aprovacoes.itens.length > 0 && (
          <View>
            <Text style={s.sec}>Aprovações e decisões</Text>
            {c.aprovacoes.intro ? <Text style={s.itemDesc}>{c.aprovacoes.intro}</Text> : null}
            <Itens itens={c.aprovacoes.itens} />
          </View>
        )}

        {c.comunicacao.ativo && c.comunicacao.blocos.length > 0 && (
          <View>
            <Text style={s.sec}>Fluxo de comunicação</Text>
            <Itens itens={c.comunicacao.blocos} />
          </View>
        )}

        {c.projetosAprovacoes.ativo && c.projetosAprovacoes.etapas.length > 0 && (
          <View>
            <Text style={s.sec}>Projetos — aprovações</Text>
            <Itens itens={c.projetosAprovacoes.etapas} />
          </View>
        )}

        {c.periodoObras.ativo && (
          <View>
            <Text style={s.sec}>Período de obras</Text>
            <Text style={[s.texto, { fontWeight: 700 }]}>{c.periodoObras.texto}</Text>
            <Text style={s.itemDesc}>{c.periodoObras.observacao}</Text>
          </View>
        )}

        {c.registros.ativo && c.registros.blocos.length > 0 && (
          <View>
            <Text style={s.sec}>Registros e documentos de obra</Text>
            <Itens itens={c.registros.blocos} />
          </View>
        )}

        {c.logistica.ativo && (
          <View>
            <Text style={s.sec}>{c.logistica.titulo}</Text>
            <Text style={s.texto}>{c.logistica.texto}</Text>
          </View>
        )}

        {c.tecnicos.ativo && c.tecnicos.blocos.length > 0 && (
          <View>
            <Text style={s.sec}>Assuntos técnicos de obra</Text>
            {c.tecnicos.blocos.map((b, i) => (
              <View key={i} wrap={false}>
                <Text style={[s.itemTitulo, { color: OLIVA_ESC }]}>{b.titulo}</Text>
                {b.topicos.map((t, j) => (
                  <View key={j}>
                    <Text style={[s.itemDesc, { fontWeight: 700, color: CARVAO }]}>{t.titulo}</Text>
                    <Text style={s.itemDesc}>{t.descricao}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {c.condominio.ativo && c.condominio.texto.trim() ? (
          <View>
            <Text style={s.sec}>Interface com o condomínio</Text>
            <Text style={s.texto}>{c.condominio.texto}</Text>
          </View>
        ) : null}

        <Rodape cliente={cliente} />
      </Page>
    </Document>
  );
}
