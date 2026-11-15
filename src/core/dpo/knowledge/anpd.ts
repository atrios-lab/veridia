// Sources: resolutions of the Conselho Diretor da ANPD as published in the
// Diário Oficial da União (in.gov.br), consulted on 2026-11-15:
// Res. 2/2022 https://www.in.gov.br/en/web/dou/-/resolucao-cd/anpd-n-2-de-27-de-janeiro-de-2022-376562019
//   (art. 14, II with the wording of Res. 15/2024, as compiled at
//   https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd/resolucao-cd-anpd-no-2-de-27-de-janeiro-de-2022)
// Res. 15/2024 https://www.in.gov.br/en/web/dou/-/resolucao-cd/anpd-n-15-de-24-de-abril-de-2024-556243024
// Res. 18/2024 https://www.in.gov.br/en/web/dou/-/resolucao-cd/anpd-n-18-de-16-de-julho-de-2024-572632074
// Res. 4/2023 https://www.in.gov.br/en/web/dou/-/resolucao-cd/anpd-n-4-de-24-de-fevereiro-de-2023-466146077
// Res. 19/2024 https://www.in.gov.br/en/web/dou/-/resolucao-cd/anpd-n-19-de-23-de-agosto-de-2024-580095396
// Article numbers are those of the regulation annexed to each resolution.
// Omitted: the resolutions' own articles, headings, signatures, the
// appendices of Res. 4/2023 and Annex II (standard clauses) of Res. 19/2024,
// and articles of little use to a notary office's DPO: Res. 15/2024 arts. 11
// to 14, 18, 20, 22 and 24 (ANPD internal procedure); Res. 18/2024 art. 5
// (public law entities); Res. 4/2023 arts. 6, 11 and 14 to 28 (fine
// calculation and payment); Res. 19/2024 arts. 10 to 14 and 18 onwards
// (adequacy decisions, specific clauses, global corporate rules).

import type { KnowledgeProvision } from "./types.ts";

export const ANPD: readonly KnowledgeProvision[] = [
  {
    id: "anpd-res-2-2022-art-1",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 2/2022, art. 1º",
    text: `Art. 1º Este regulamento tem por objetivo regulamentar a aplicação da Lei nº 13.709, de 14 de agosto de 2018, Lei Geral de Proteção de Dados Pessoais (LGPD), para agentes de tratamento de pequeno porte, com base nas competências previstas no art. 55-J, inciso XVIII, da referida Lei.
Parágrafo único. Este regulamento não se aplica ao tratamento de dados pessoais realizado por pessoa natural para fins exclusivamente particulares e não econômicos, bem como nas demais hipóteses previstas no art. 4º da LGPD.`,
  },
  {
    id: "anpd-res-2-2022-art-2",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 2/2022, art. 2º",
    text: `Art. 2º Para efeitos deste regulamento são adotadas as seguintes definições:
I - agentes de tratamento de pequeno porte: microempresas, empresas de pequeno porte, startups, pessoas jurídicas de direito privado, inclusive sem fins lucrativos, nos termos da legislação vigente, bem como pessoas naturais e entes privados despersonalizados que realizam tratamento de dados pessoais, assumindo obrigações típicas de controlador ou de operador;
II - microempresas e empresas de pequeno porte: sociedade empresária, sociedade simples, sociedade limitada unipessoal, nos termos do art. 41 da Lei nº 14.195, de 26 de agosto de 2021, e o empresário a que se refere o art. 966 da Lei nº 10.406, de 10 de janeiro de 2002 (Código Civil), incluído o microempreendedor individual, devidamente registrados no Registro de Empresas Mercantis ou no Registro Civil de Pessoas Jurídicas, que se enquadre nos termos do art. 3º e 18-A, §1º da Lei Complementar nº 123, de 14 de dezembro de 2006;
III - startups: organizações empresariais ou societárias, nascentes ou em operação recente, cuja atuação caracteriza-se pela inovação aplicada a modelo de negócios ou a produtos ou serviços ofertados, que atendam aos critérios previstos no Capítulo II da Lei Complementar nº 182, de 1º de junho de 2021; e
IV - zonas acessíveis ao público: espaços abertos ao público, como praças, centros comerciais, vias públicas, estações de ônibus, de metrô e de trem, aeroportos, portos, bibliotecas públicas, dentre outros.`,
  },
  {
    id: "anpd-res-2-2022-art-3",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 2/2022, art. 3º",
    text: `Art. 3º Não poderão se beneficiar do tratamento jurídico diferenciado previsto neste Regulamento os agentes de tratamento de pequeno porte que:
I - realizem tratamento de alto risco para os titulares, ressalvada a hipótese prevista no art. 8º;
II - aufiram receita bruta superior ao limite estabelecido no art. 3º, II, da Lei Complementar nº 123, de 2006 ou, no caso de startups, no art. 4º, § 1º, I, da Lei Complementar nº 182, de 2021; ou
III - pertençam a grupo econômico de fato ou de direito, cuja receita global ultrapasse os limites referidos no inciso II, conforme o caso.`,
  },
  {
    id: "anpd-res-2-2022-art-4",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 2/2022, art. 4º",
    text: `Art. 4º Para fins deste regulamento, e sem prejuízo do disposto no art. 16, será considerado de alto risco o tratamento de dados pessoais que atender cumulativamente a pelo menos um critério geral e um critério específico, dentre os a seguir indicados:
I - critérios gerais:
a) tratamento de dados pessoais em larga escala; ou
b) tratamento de dados pessoais que possa afetar significativamente interesses e direitos fundamentais dos titulares;
II - critérios específicos:
a) uso de tecnologias emergentes ou inovadoras;
b) vigilância ou controle de zonas acessíveis ao público;
c) decisões tomadas unicamente com base em tratamento automatizado de dados pessoais, inclusive aquelas destinadas a definir o perfil pessoal, profissional, de saúde, de consumo e de crédito ou os aspectos da personalidade do titular; ou
d) utilização de dados pessoais sensíveis ou de dados pessoais de crianças, de adolescentes e de idosos.
§ 1º O tratamento de dados pessoais em larga escala será caracterizado quando abranger número significativo de titulares, considerando-se, ainda, o volume de dados envolvidos, bem como a duração, a frequência e a extensão geográfica do tratamento realizado.
§ 2º O tratamento de dados pessoais que possa afetar significativamente interesses e direitos fundamentais será caracterizado, dentre outras situações, naquelas em que a atividade de tratamento puder impedir o exercício de direitos ou a utilização de um serviço, assim como ocasionar danos materiais ou morais aos titulares, tais como discriminação, violação à integridade física, ao direito à imagem e à reputação, fraudes financeiras ou roubo de identidade.
§ 3º A ANPD poderá disponibilizar guias e orientações com o objetivo de auxiliar os agentes de tratamento de pequeno porte na avaliação do tratamento de alto risco.`,
  },
  {
    id: "anpd-res-2-2022-art-5",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 2/2022, art. 5º",
    text: `Art. 5º Caberá ao agente de tratamento de pequeno porte, quando solicitado pela ANPD, comprovar que se enquadra nas disposições do art. 2º e do art. 3º deste regulamento em até quinze dias.`,
  },
  {
    id: "anpd-res-2-2022-art-6",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 2/2022, art. 6º",
    text: `Art. 6º A dispensa ou flexibilização das obrigações dispostas neste regulamento não isenta os agentes de tratamento de pequeno porte do cumprimento dos demais dispositivos da LGPD, inclusive das bases legais e dos princípios, de outras disposições legais, regulamentares e contratuais relativas à proteção de dados pessoais, bem como direitos dos titulares.`,
  },
  {
    id: "anpd-res-2-2022-art-7",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 2/2022, art. 7º",
    text: `Art. 7º Os agentes de tratamento de pequeno porte devem disponibilizar informações sobre o tratamento de dados pessoais e atender às requisições dos titulares em conformidade com o disposto nos arts. 9º e 18 da LGPD, por meio:
I - eletrônico;
II - impresso; ou
III - qualquer outro que assegure os direitos previstos na LGPD e o acesso facilitado às informações pelos titulares.`,
  },
  {
    id: "anpd-res-2-2022-art-8",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 2/2022, art. 8º",
    text: `Art. 8º Fica facultado aos agentes de tratamento de pequeno porte, inclusive àqueles que realizem tratamento de alto risco, organizarem-se por meio de entidades de representação da atividade empresarial, por pessoas jurídicas ou por pessoas naturais para fins de negociação, mediação e conciliação de reclamações apresentadas por titulares de dados.`,
  },
  {
    id: "anpd-res-2-2022-art-9",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 2/2022, art. 9º",
    text: `Art. 9º Os agentes de tratamento de pequeno porte podem cumprir a obrigação de elaboração e manutenção de registro das operações de tratamento de dados pessoais, constante do art. 37 da LGPD, de forma simplificada.
Parágrafo único. A ANPD fornecerá modelo para o registro simplificado de que trata o caput.`,
  },
  {
    id: "anpd-res-2-2022-art-10",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 2/2022, art. 10",
    text: `Art. 10. A ANPD disporá sobre flexibilização ou procedimento simplificado de comunicação de incidente de segurança para agentes de tratamento de pequeno porte, nos termos da regulamentação específica.`,
  },
  {
    id: "anpd-res-2-2022-art-11",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 2/2022, art. 11",
    text: `Art. 11. Os agentes de tratamento de pequeno porte não são obrigados a indicar o encarregado pelo tratamento de dados pessoais exigido no art. 41 da LGPD.
§ 1º O agente de tratamento de pequeno porte que não indicar um encarregado deve disponibilizar um canal de comunicação com o titular de dados para atender o disposto no art. 41, § 2º, I da LGPD.
§ 2º A indicação de encarregado por parte dos agentes de tratamento de pequeno porte será considerada política de boas práticas e governança para fins do disposto no art. 52, §1º, IX da LGPD.`,
  },
  {
    id: "anpd-res-2-2022-art-12",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 2/2022, art. 12",
    text: `Art. 12. Os agentes de tratamento de pequeno porte devem adotar medidas administrativas e técnicas essenciais e necessárias, com base em requisitos mínimos de segurança da informação para proteção dos dados pessoais, considerando, ainda, o nível de risco à privacidade dos titulares de dados e a realidade do agente de tratamento.
Parágrafo único. O atendimento às recomendações e às boas práticas de prevenção e segurança divulgadas pela ANPD, inclusive por meio de guias orientativos, será considerado como observância ao disposto no art. 52, §1º, VIII da LGPD.`,
  },
  {
    id: "anpd-res-2-2022-art-13",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 2/2022, art. 13",
    text: `Art. 13. Os agentes de tratamento de pequeno porte podem estabelecer política simplificada de segurança da informação, que contemple requisitos essenciais e necessários para o tratamento de dados pessoais, com o objetivo de protegê-los de acessos não autorizados e de situações acidentais ou ilícitas de destruição, perda, alteração, comunicação ou qualquer forma de tratamento inadequado ou ilícito.
§ 1º A política simplificada de segurança da informação deve levar em consideração os custos de implementação, bem como a estrutura, a escala e o volume das operações do agente de tratamento de pequeno porte.
§ 2º A ANPD considerará a existência de política simplificada de segurança da informação para fins do disposto no art. 6º, X e no art. 52, §1º, VIII e IX da LGPD.`,
  },
  {
    id: "anpd-res-2-2022-art-14",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 2/2022, art. 14",
    text: `Art. 14. Aos agentes de tratamento de pequeno porte será concedido prazo em dobro:
I - no atendimento das solicitações dos titulares referentes ao tratamento de seus dados pessoais, conforme previsto no art. 18, §§ 3º e 5º da LGPD, nos termos de regulamentação específica;
II - no caso da comunicação, à ANPD e ao titular, da ocorrência de incidente de segurança que possa acarretar risco ou dano relevante aos titulares, nos termos do Regulamento de Comunicação de Incidente de Segurança, aprovado pela Resolução CD/ANPD nº 15, de 24 de abril de 2024; (Redação dada pela Resolução CD/ANPD nº 15, de 2024)
III - no fornecimento de declaração clara e completa, prevista no art. 19, II da LGPD;
IV - em relação aos prazos estabelecidos nos normativos próprios para a apresentação de informações, documentos, relatórios e registros solicitados pela ANPD a outros agentes de tratamento.
Parágrafo único. Os prazos não dispostos neste regulamento para agentes de tratamento de pequeno porte serão determinados por regulamentação específica.`,
  },
  {
    id: "anpd-res-2-2022-art-15",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 2/2022, art. 15",
    text: `Art. 15. Os agentes de tratamento de pequeno porte podem fornecer a declaração simplificada de que trata o art. 19, I, da LGPD no prazo de até quinze dias, contados da data do requerimento do titular.`,
  },
  {
    id: "anpd-res-2-2022-art-16",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 2/2022, art. 16",
    text: `Art. 16. A ANPD poderá determinar ao agente de tratamento de pequeno porte o cumprimento das obrigações dispensadas ou flexibilizadas neste regulamento, considerando as circunstâncias relevantes da situação, tais como a natureza ou o volume das operações, bem como os riscos para os titulares.`,
  },
  {
    id: "anpd-res-15-2024-art-1",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 15/2024, art. 1º",
    text: `Art. 1º Este Regulamento tem por objetivo estabelecer os procedimentos para Comunicação de Incidente de Segurança, que possa acarretar risco ou dano relevante aos titulares, nos termos do art. 48 da Lei nº 13.709, de 14 de agosto de 2018 - Lei Geral de Proteção de Dados Pessoais (LGPD).`,
  },
  {
    id: "anpd-res-15-2024-art-2",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 15/2024, art. 2º",
    text: `Art. 2º São objetivos deste Regulamento:
I - proteger os direitos dos titulares;
II - assegurar a adoção das medidas necessárias para mitigar ou reverter os efeitos dos prejuízos gerados;
III - assegurar a efetividade do princípio da responsabilização e da prestação de contas pelos agentes de tratamento;
IV - promover a adoção de regras de boas práticas, de governança, de medidas de prevenção e segurança adequadas;
V - estimular a promoção da cultura de proteção de dados pessoais;
VI - garantir que os agentes de tratamento atuem de forma transparente e estabeleçam uma relação de confiança com o titular; e
VII - fornecer subsídios para as atividades regulatória, fiscalizatória e sancionatória da Autoridade Nacional de Proteção de Dados (ANPD).`,
  },
  {
    id: "anpd-res-15-2024-art-3",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 15/2024, art. 3º",
    text: `Art. 3º Para efeitos deste Regulamento, são adotadas as seguintes definições:
I - ampla divulgação do incidente em meios de comunicação: providência que pode ser determinada pela ANPD ao controlador, nos termos do art. 48, § 2º, I, da LGPD, no âmbito do processo de comunicação de incidente de segurança, como a publicação no sítio eletrônico, nas redes sociais do controlador ou em outros meios de comunicação;
II - autenticidade: propriedade pela qual se assegura que a informação foi produzida, expedida, modificada ou destruída por uma determinada pessoa física, equipamento, sistema, órgão ou entidade;
III - categoria de dados pessoais: classificação dos dados pessoais de acordo com o contexto de sua utilização, tais como dados de identificação pessoal, dados de autenticação em sistemas, dados financeiros;
IV - comunicação de incidente de segurança: ato do controlador que comunica à ANPD e ao titular de dados a ocorrência de incidente de segurança que possa acarretar risco ou dano relevante aos titulares;
V - confidencialidade: propriedade pela qual se assegura que o dado pessoal não esteja disponível ou não seja revelado a pessoas, empresas, sistemas, órgãos ou entidades não autorizados;
VI - dado de autenticação em sistemas: qualquer dado pessoal utilizado como credencial para determinar o acesso a um sistema ou para confirmar a identificação de um usuário, como contas de login, tokens e senhas;
VII - dado financeiro: dado pessoal relacionado às transações financeiras do titular, inclusive para contratação de serviços e aquisição de produtos;
VIII - dado pessoal afetado: dado pessoal cuja confidencialidade, integridade, disponibilidade ou autenticidade tenha sido comprometida em um incidente de segurança;
IX - dado protegido por sigilo legal ou judicial: dado pessoal cujo sigilo decorra de norma jurídica ou decisão judicial;
X - dado protegido por sigilo profissional: dado pessoal cujo sigilo decorra do exercício de função, ministério, ofício ou profissão, e cuja revelação possa produzir dano a outrem;
XI - disponibilidade: propriedade pela qual se assegura que o dado pessoal esteja acessível e utilizável, sob demanda, por uma pessoa natural ou determinado sistema, órgão ou entidade devidamente autorizados;
XII - incidente de segurança: qualquer evento adverso confirmado, relacionado à violação das propriedades de confidencialidade, integridade, disponibilidade e autenticidade da segurança de dados pessoais;
XIII - integridade: propriedade pela qual se assegura que o dado pessoal não foi modificado ou destruído de maneira não autorizada ou acidental;
XIV - medidas de segurança: medidas técnicas e/ou administrativas adotadas para proteger os dados pessoais de acessos não autorizados e de situações acidentais ou ilícitas de destruição, perda, alteração, comunicação ou difusão;
XV - natureza dos dados pessoais: classificação de dados pessoais em gerais ou sensíveis;
XVI - procedimento de apuração de incidente de segurança: procedimento instaurado pela ANPD para apurar a ocorrência de incidente de segurança que não tenha sido comunicado pelo controlador;
XVII - procedimento de comunicação de incidente de segurança: procedimento instaurado no âmbito da ANPD após o recebimento de comunicação de incidente de segurança;
XVIII - processo de comunicação de incidente de segurança: processo administrativo instaurado no âmbito da ANPD que abrange o procedimento de apuração incidente de segurança e o procedimento de comunicação de incidente de segurança; e
XIX - relatório de tratamento de incidente: documento fornecido pelo controlador que contém cópias, em meio físico ou digital, de dados e informações relevantes para descrever o incidente e as providências adotadas para reverter ou mitigar os seus efeitos.`,
  },
  {
    id: "anpd-res-15-2024-art-4",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 15/2024, art. 4º",
    text: `Art. 4º O controlador deverá comunicar à ANPD e ao titular a ocorrência de incidente de segurança que possa acarretar risco ou dano relevante aos titulares.`,
  },
  {
    id: "anpd-res-15-2024-art-5",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 15/2024, art. 5º",
    text: `Art. 5º O incidente de segurança pode acarretar risco ou dano relevante aos titulares quando puder afetar significativamente interesses e direitos fundamentais dos titulares e, cumulativamente, envolver, pelo menos, um dos seguintes critérios:
I - dados pessoais sensíveis;
II - dados de crianças, de adolescentes ou de idosos;
III - dados financeiros;
IV - dados de autenticação em sistemas;
V - dados protegidos por sigilo legal, judicial ou profissional; ou
VI - dados em larga escala.
§ 1º O incidente de segurança que possa afetar significativamente interesses e direitos fundamentais será caracterizado, dentre outras situações, naquelas em que a atividade de tratamento puder impedir o exercício de direitos ou a utilização de um serviço, assim como ocasionar danos materiais ou morais aos titulares, tais como discriminação, violação à integridade física, ao direito à imagem e à reputação, fraudes financeiras ou roubo de identidade.
§ 2º Considera-se incidente com dados em larga escala aquele que abranger número significativo de titulares, considerando, ainda, o volume de dados envolvidos, bem como a duração, a frequência e a extensão geográfica de localização dos titulares.
§ 3º A ANPD poderá publicar orientações com o objetivo de auxiliar os agentes de tratamento na avaliação do incidente que possa acarretar risco ou dano relevante aos titulares.`,
  },
  {
    id: "anpd-res-15-2024-art-6",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 15/2024, art. 6º",
    text: `Art. 6º A comunicação de incidente de segurança à ANPD deverá ser realizada pelo controlador no prazo de três dias úteis, ressalvada a existência de prazo para comunicação previsto em legislação específica.
§ 1º O prazo a que se refere o caput será contado do conhecimento pelo controlador de que o incidente afetou dados pessoais.
§ 2º A comunicação de incidente de segurança deverá conter as seguintes informações:
I - a descrição da natureza e da categoria de dados pessoais afetados;
II - o número de titulares afetados, discriminando, quando aplicável, o número de crianças, de adolescentes ou de idosos;
III - as medidas técnicas e de segurança utilizadas para a proteção dos dados pessoais, adotadas antes e após o incidente, observados os segredos comercial e industrial;
IV - os riscos relacionados ao incidente com identificação dos possíveis impactos aos titulares;
V - os motivos da demora, no caso de a comunicação não ter sido realizada no prazo previsto no caput deste artigo;
VI - as medidas que foram ou que serão adotadas para reverter ou mitigar os efeitos do incidente sobre os titulares;
VII - a data da ocorrência do incidente, quando possível determiná-la, e a de seu conhecimento pelo controlador;
VIII - os dados do encarregado ou de quem represente o controlador;
IX - a identificação do controlador e, se for o caso, declaração de que se trata de agente de tratamento de pequeno porte;
X - a identificação do operador, quando aplicável;
XI - a descrição do incidente, incluindo a causa principal, caso seja possível identificá-la; e
XII - o total de titulares cujos dados são tratados nas atividades de tratamento afetadas pelo incidente.
§ 3º As informações poderão ser complementadas, de maneira fundamentada, no prazo de vinte dias úteis, a contar da data da comunicação.
§ 4º A comunicação de incidente de segurança deverá ocorrer por meio de formulário eletrônico disponibilizado pela ANPD.
§ 5º A comunicação de incidente de segurança deverá ser realizada pelo controlador, por meio do encarregado, acompanhada de documento comprobatório de vínculo contratual, empregatício ou funcional, ou por meio de representante constituído, acompanhada de instrumento com poderes de representação junto à ANPD.
§ 6º Os documentos de que trata o § 5º deverão ser apresentados juntamente com a comunicação do incidente de segurança, no prazo previsto no caput deste artigo.
§ 7º No caso de descumprimento do previsto no § 6º, a ANPD poderá apurar a ocorrência do incidente de segurança por meio do procedimento de apuração de incidente de segurança.
§ 8º Os prazos constantes no caput e no § 3º deste artigo são contados em dobro para os agentes de pequeno porte, nos termos do disposto no Regulamento de aplicação da Lei nº 13.709, de 14 de agosto de 2018, Lei Geral de Proteção de Dados Pessoais (LGPD), aos agentes de tratamento de pequeno porte, aprovado pela Resolução CD/ANPD nº 2, de 27 de janeiro de 2022.`,
  },
  {
    id: "anpd-res-15-2024-art-7",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 15/2024, art. 7º",
    text: `Art. 7º Cabe ao controlador solicitar à ANPD, de maneira fundamentada, o sigilo de informações protegidas por lei, indicando aquelas cujo acesso deverá ser restringido, a exemplo das relativas à sua atividade empresarial cuja divulgação possa representar violação de segredo comercial ou industrial.`,
  },
  {
    id: "anpd-res-15-2024-art-8",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 15/2024, art. 8º",
    text: `Art. 8º A ANPD poderá, a qualquer tempo, solicitar informações adicionais ao controlador, referentes ao incidente de segurança, inclusive o registro das operações de tratamento dos dados pessoais afetados pelo incidente, o relatório de impacto à proteção de dados pessoais (RIPD) e o relatório de tratamento do incidente, estabelecendo prazo para o envio das informações.`,
  },
  {
    id: "anpd-res-15-2024-art-9",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 15/2024, art. 9º",
    text: `Art. 9º A comunicação de incidente de segurança ao titular deverá ser realizada pelo controlador no prazo de três dias úteis contados do conhecimento pelo controlador de que o incidente afetou dados pessoais, e deverá conter as seguintes informações:
I - a descrição da natureza e da categoria de dados pessoais afetados;
II - as medidas técnicas e de segurança utilizadas para a proteção dos dados, observados os segredos comercial e industrial;
III - os riscos relacionados ao incidente com identificação dos possíveis impactos aos titulares;
IV - os motivos da demora, no caso de a comunicação não ter sido feita no prazo do caput deste artigo;
V - as medidas que foram ou que serão adotadas para reverter ou mitigar os efeitos do incidente, quando cabíveis;
VI - a data do conhecimento do incidente de segurança; e
VII - o contato para obtenção de informações e, quando aplicável, os dados de contato do encarregado.
§ 1º A comunicação do incidente aos titulares de dados deverá atender aos seguintes critérios:
I - fazer uso de linguagem simples e de fácil entendimento; e
II - ocorrer de forma direta e individualizada, caso seja possível identificá-los.
§ 2º Considera-se comunicação de forma direta e individualizada aquela realizada pelos meios usualmente utilizados pelo controlador para contatar o titular, tais como telefone, e-mail, mensagem eletrônica ou carta.
§ 3º Caso a comunicação direta e individualizada mostre-se inviável ou não seja possível identificar, parcial ou integralmente, os titulares afetados, o controlador deverá comunicar a ocorrência do incidente, no prazo e com as informações definidas no caput, pelos meios de divulgação disponíveis, tais como seu sítio eletrônico, aplicativos, suas mídias sociais e canais de atendimento ao titular, de modo que a comunicação permita o conhecimento amplo, com direta e fácil visualização, pelo período de, no mínimo, três meses.
§ 4º O controlador deverá juntar ao processo de comunicação de incidente uma declaração de que foi realizada a comunicação aos titulares, constando os meios de comunicação ou divulgação utilizados, em até três dias úteis, contados do término do prazo de que trata o caput deste artigo.
§ 5º Poderá ser considerada boa prática, para fins do disposto no art. 52, § 1º, IX, da LGPD, a inclusão, na comunicação ao titular, de recomendações aptas a reverter ou mitigar os efeitos do incidente.
§ 6º O prazo constante no caput deste artigo é contado em dobro para os agentes de pequeno porte, nos termos do disposto no Regulamento de aplicação da Lei nº 13.709, de 14 de agosto de 2018, Lei Geral de Proteção de Dados Pessoais (LGPD) aos agentes de tratamento de pequeno porte, aprovado pela Resolução CD/ANPD nº 2, de 27 de janeiro de 2022.`,
  },
  {
    id: "anpd-res-15-2024-art-10",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 15/2024, art. 10",
    text: `Art. 10. O controlador deverá manter o registro do incidente de segurança, inclusive daquele não comunicado à ANPD e aos titulares, pelo prazo mínimo de cinco anos, contado a partir da data do registro, exceto se constatadas obrigações adicionais que demandem maior prazo de manutenção.
§ 1º O registro do incidente deverá conter, no mínimo:
I - a data de conhecimento do incidente;
II - a descrição geral das circunstâncias em que o incidente ocorreu;
III - a natureza e a categoria de dados afetados;
IV - o número de titulares afetados;
V - a avaliação do risco e os possíveis danos aos titulares;
VI - as medidas de correção e mitigação dos efeitos do incidente, quando aplicável;
VII - a forma e o conteúdo da comunicação, se o incidente tiver sido comunicado à ANPD e aos titulares; e
VIII - os motivos da ausência de comunicação, quando for o caso.
§ 2º Os prazos de guarda previstos neste artigo não se aplicam às entidades previstas no art. 23 da LGPD, desde que sejam observadas as regras aplicáveis aos documentos de guarda permanente previstas na tabela de temporalidade própria ou definidas pelo Conselho Nacional de Arquivos.`,
  },
  {
    id: "anpd-res-15-2024-art-15",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 15/2024, art. 15",
    text: `Art. 15. No curso do processo de comunicação de incidente de segurança, a ANPD poderá determinar ao controlador, com ou sem a sua prévia manifestação, a adoção imediata de medidas preventivas necessárias para salvaguardar direitos dos titulares, a fim de prevenir, mitigar ou reverter os efeitos do incidente e evitar a ocorrência de dano grave e irreparável ou de difícil reparação.
Parágrafo único. A ANPD poderá fixar multa diária para assegurar o cumprimento da determinação prevista no caput, na forma do Regulamento de Dosimetria e Aplicação de Sanções Administrativas, aprovado pela Resolução CD/ANPD nº 4, de 24 de fevereiro de 2023.`,
  },
  {
    id: "anpd-res-15-2024-art-16",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 15/2024, art. 16",
    text: `Art. 16. A ANPD poderá apurar, por meio do procedimento de apuração de incidente de segurança, a ocorrência de incidentes que possam acarretar risco ou dano relevante aos titulares, não comunicados pelo controlador, de que venha a tomar conhecimento.
§ 1º A ANPD poderá requisitar ao controlador informações para apurar a ocorrência do incidente de segurança.
§ 2º A ANPD avaliará a ocorrência do incidente por meio dos critérios dispostos no art. 5º deste Regulamento.`,
  },
  {
    id: "anpd-res-15-2024-art-17",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 15/2024, art. 17",
    text: `Art. 17. Constatada a ocorrência de incidente de segurança, a ANPD determinará ao controlador o envio da comunicação à Autoridade e aos titulares, observados os prazos e condições descritos nos arts. 6º e 9º deste Regulamento, respectivamente.
§ 1º A ANPD poderá, ainda, instaurar processo administrativo sancionador para apurar o descumprimento do previsto nos arts. 6º e 9º deste Regulamento.
§ 2º Realizada a comunicação de incidente de segurança, na forma do caput, aplicar-se-á o procedimento de comunicação de incidente de segurança estabelecido na Seção III.`,
  },
  {
    id: "anpd-res-15-2024-art-19",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 15/2024, art. 19",
    text: `Art. 19. Após avaliar a gravidade do incidente de segurança, a ANPD poderá determinar ao controlador a adoção de providências para a salvaguarda dos direitos dos titulares, tais como:
I - ampla divulgação do incidente em meios de comunicação; e
II - medidas para reverter ou mitigar os efeitos do incidente.
§ 1º A gravidade do incidente será avaliada com base nas informações obtidas e nos critérios de que trata o art. 5º deste Regulamento.
§ 2º As providências citadas no caput devem estar diretamente relacionadas ao incidente.
§ 3º A ANPD poderá determinar ampla divulgação do incidente em meios de comunicação, às expensas do controlador, para a salvaguarda dos direitos dos titulares, nos termos do art. 48, § 2º, I, da LGPD, quando a comunicação realizada pelo controlador mostrar-se insuficiente para alcançar parcela significativa dos titulares afetados pelo incidente.
§ 4º A ampla divulgação do incidente em meios de comunicação deverá ser compatível com a abrangência de atuação do controlador e a localização dos titulares dos dados pessoais afetados no incidente.
§ 5º A ampla divulgação do incidente poderá ser viabilizada em meio físico ou digital, considerada sempre a necessidade de se atingir o maior número possível de titulares afetados, admitidos os seguintes meios de veiculação:
I - mídia escrita impressa;
II - radiodifusão de sons e de sons e imagens; ou
III - transmissão de informações pela Internet.
§ 6º A ampla divulgação do incidente não se confunde com a sanção de publicização da infração de que trata no art. 52, IV, da LGPD.
§ 7º Na determinação das medidas para reverter ou mitigar os efeitos do incidente, serão consideradas aquelas que possam garantir a confidencialidade, a integridade, a disponibilidade e a autenticidade dos dados pessoais afetados, bem como minimizar os efeitos decorrentes do incidente para os titulares.`,
  },
  {
    id: "anpd-res-15-2024-art-21",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 15/2024, art. 21",
    text: `Art. 21. A ANPD poderá instaurar processo administrativo sancionador caso o controlador não adote as medidas para reverter ou mitigar os efeitos do incidente de segurança no prazo e nas condições determinadas pela Autoridade.`,
  },
  {
    id: "anpd-res-15-2024-art-23",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 15/2024, art. 23",
    text: `Art. 23. O processo de comunicação de incidente de segurança será declarado extinto nas seguintes hipóteses:
I - caso não sejam identificadas evidências suficientes da ocorrência do incidente, ressalvada a possibilidade de reabertura caso surjam fatos novos;
II - caso a ANPD considere que o incidente não possui potencial para acarretar risco ou dano relevante aos titulares, nos termos do art. 5º deste Regulamento;
III - caso o incidente não envolva dados pessoais;
IV - caso tenham sido tomadas todas as medidas adicionais para mitigação ou reversão dos efeitos gerados; ou
V - realização da comunicação aos titulares e adoção das providências pertinentes pelo controlador, em conformidade com a LGPD, as disposições deste Regulamento e as determinações da ANPD.
Parágrafo único. Na hipótese do inciso II do caput, mesmo com a declaração da extinção do processo de comunicação de incidente de segurança, a ANPD poderá determinar a adoção de medidas de segurança diretamente relacionadas ao incidente, com o intuito de salvaguardar os direitos dos titulares.`,
  },
  {
    id: "anpd-res-18-2024-art-1",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 18/2024, art. 1º",
    text: `Art. 1º Este Regulamento estabelece normas complementares sobre a indicação, a definição, as atribuições e a atuação do encarregado, de que trata a Lei nº 13.709, de 14 de agosto de 2018.`,
  },
  {
    id: "anpd-res-18-2024-art-2",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 18/2024, art. 2º",
    text: `Art. 2º Para fins deste Regulamento adotam-se as seguintes definições:
I - agentes de tratamento: o controlador e o operador;
II - conflito de interesse: a situação que possa comprometer, influenciar ou afetar, de maneira imprópria, a objetividade e o julgamento técnico no desempenho das atribuições do encarregado;
III - controlador: pessoa natural ou jurídica, de direito público ou privado, a quem competem as decisões referentes ao tratamento de dados pessoais;
IV - dado pessoal: informação relacionada a pessoa natural identificada ou identificável;
V - encarregado: pessoa indicada pelo controlador e operador para atuar como canal de comunicação entre o controlador, os titulares dos dados e a Autoridade Nacional de Proteção de Dados (ANPD);
VI - operador: pessoa natural ou jurídica, de direito público ou privado, que realiza o tratamento de dados pessoais em nome do controlador;
VII - titular: pessoa natural a quem se referem os dados pessoais que são objeto de tratamento; e
VIII - tratamento: toda operação realizada com dados pessoais, como as que se referem a coleta, produção, recepção, classificação, utilização, acesso, reprodução, transmissão, distribuição, processamento, arquivamento, armazenamento, eliminação, avaliação ou controle da informação, modificação, comunicação, transferência, difusão ou extração.`,
  },
  {
    id: "anpd-res-18-2024-art-3",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 18/2024, art. 3º",
    text: `Art. 3º A indicação do encarregado deve ser realizada por ato formal do agente de tratamento, do qual constem as formas de atuação e as atividades a serem desempenhadas.
§ 1º Entende-se por ato formal o documento escrito, datado e assinado, que, de maneira clara e inequívoca, demonstre a intenção do agente de tratamento em designar como encarregado uma pessoa natural ou uma pessoa jurídica.
§ 2º O documento referido no caput deverá ser apresentado à ANPD, quando solicitado.
§ 3º Os Agentes de Tratamento de Pequeno Porte dispensados de indicar encarregado devem disponibilizar um canal de comunicação com o titular de dados, nos termos do art. 11 do Regulamento de aplicação da LGPD para Agentes de Tratamento de Pequeno Porte, aprovado pela Resolução CD/ANPD nº 2, de 27 de janeiro de 2022.`,
  },
  {
    id: "anpd-res-18-2024-art-4",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 18/2024, art. 4º",
    text: `Art. 4º Nas ausências, impedimentos e vacâncias do encarregado, a função será exercida por substituto formalmente designado.
Parágrafo único. As situações referidas no caput não poderão consistir em obstáculos para o exercício dos direitos dos titulares ou para o atendimento às comunicações da ANPD.`,
  },
  {
    id: "anpd-res-18-2024-art-6",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 18/2024, art. 6º",
    text: `Art. 6º A indicação de encarregado por operadores é facultativa e será considerada política de boas práticas de governança para fins do disposto no art. 52, § 1º, inciso IX, da Lei nº 13.709, de 14 de agosto de 2018, e no art. 13, inciso II, do anexo da Resolução CD/ANPD nº 4, de 24 de fevereiro de 2023, desde que observadas as normas deste Regulamento.`,
  },
  {
    id: "anpd-res-18-2024-art-7",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 18/2024, art. 7º",
    text: `Art. 7º Cabe ao agente de tratamento estabelecer as qualificações profissionais necessárias para o desempenho das atribuições do encarregado, considerando seus conhecimentos sobre a legislação de proteção de dados pessoais, bem como o contexto, o volume e o risco das operações de tratamento realizadas.`,
  },
  {
    id: "anpd-res-18-2024-art-8",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 18/2024, art. 8º",
    text: `Art. 8º O agente de tratamento deverá divulgar e manter atualizadas a identidade e as informações de contato do encarregado.`,
  },
  {
    id: "anpd-res-18-2024-art-9",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 18/2024, art. 9º",
    text: `Art. 9º A identidade e as informações de contato do encarregado deverão ser divulgadas publicamente, de forma clara e objetiva, em local de destaque e de fácil acesso, no sítio eletrônico do agente de tratamento, ressalvada a hipótese do § 3º deste artigo.
§ 1º A divulgação da identidade do encarregado abrangerá, no mínimo:
I - o nome completo, se for pessoa natural; ou
II - o nome empresarial ou o título do estabelecimento, bem como o nome completo da pessoa natural responsável, se pessoa jurídica.
§ 2º A divulgação das informações de contato do encarregado abrangerá, no mínimo, os dados referentes aos meios de comunicação que viabilizem o exercício dos direitos dos titulares junto ao controlador e possibilitem o recebimento de comunicações da ANPD.
§ 3º O agente de tratamento que não possuir sítio eletrônico poderá realizar a divulgação da identidade e das informações de contato do encarregado por quaisquer outros meios de comunicação disponíveis, especialmente aqueles usualmente utilizados para contato com os titulares.`,
  },
  {
    id: "anpd-res-18-2024-art-10",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 18/2024, art. 10",
    text: `Art. 10. O agente de tratamento deverá
I - prover os meios necessários para o exercício das atribuições do encarregado, neles compreendidos, entre outros, recursos humanos, técnicos e administrativos;
II - solicitar assistência e orientação do encarregado quando da realização de atividades e tomada de decisões estratégicas referentes ao tratamento de dados pessoais;
III - garantir ao encarregado a autonomia técnica necessária para cumprir suas atividades, livre de interferências indevidas, especialmente na orientação a respeito das práticas a serem tomadas em relação à proteção de dados pessoais;
IV - assegurar aos titulares meios céleres, eficazes e adequados para viabilizar a comunicação com o encarregado e o exercício de direitos;
V - garantir ao encarregado acesso direto às pessoas de maior nível hierárquico dentro da organização, aos responsáveis pela tomada de decisões estratégicas que afetem ou envolvam o tratamento de dados pessoais, bem como às demais áreas da organização.`,
  },
  {
    id: "anpd-res-18-2024-art-11",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 18/2024, art. 11",
    text: `Art. 11. O agente de tratamento é o responsável pela conformidade do tratamento dos dados pessoais, nos termos da Lei nº 13.709, de 14 de agosto de 2018.`,
  },
  {
    id: "anpd-res-18-2024-art-12",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 18/2024, art. 12",
    text: `Art. 12. O encarregado poderá ser:
I - uma pessoa natural, integrante do quadro organizacional do agente de tratamento ou externo a esse; ou
II - uma pessoa jurídica.`,
  },
  {
    id: "anpd-res-18-2024-art-13",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 18/2024, art. 13",
    text: `Art. 13. O encarregado deverá ser capaz de comunicar-se com os titulares e com a ANPD, de forma clara e precisa e em língua portuguesa.`,
  },
  {
    id: "anpd-res-18-2024-art-14",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 18/2024, art. 14",
    text: `Art. 14. O exercício da atividade de encarregado não pressupõe a inscrição em qualquer entidade nem qualquer certificação ou formação profissional específica.`,
  },
  {
    id: "anpd-res-18-2024-art-15",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 18/2024, art. 15",
    text: `Art. 15. As atividades do encarregado consistem em:
I - aceitar reclamações e comunicações dos titulares, prestar esclarecimentos e adotar providências cabíveis;
II - receber comunicações da ANPD e adotar providências;
III - orientar os funcionários e os contratados do agente de tratamento a respeito das práticas a serem tomadas em relação à proteção de dados pessoais; e
IV - executar as demais atribuições determinadas pelo agente de tratamento ou estabelecidas em normas complementares.
Parágrafo único. Ao receber comunicações da ANPD, o encarregado deverá adotar as medidas necessárias para o atendimento da solicitação e para o fornecimento das informações pertinentes, adotando, entre outras, as seguintes providências:
I - encaminhar internamente a demanda para as unidades competentes;
II - fornecer a orientação e a assistência necessárias ao agente de tratamento; e
III - indicar expressamente o representante do agente de tratamento perante a ANPD para fins de atuação em processos administrativos, quando esta função não for exercida pelo próprio encarregado.`,
  },
  {
    id: "anpd-res-18-2024-art-16",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 18/2024, art. 16",
    text: `Art. 16. Cabe, ainda, ao encarregado, nos termos do art. 10, inciso II, deste Regulamento, prestar assistência e orientação ao agente de tratamento na elaboração, definição e implementação, conforme o caso, de:
I - registro e comunicação de incidente de segurança;
II - registro das operações de tratamento de dados pessoais;
III - relatório de impacto à proteção de dados pessoais;
IV - mecanismos internos de supervisão e de mitigação de riscos relativos ao tratamento de dados pessoais;
V - medidas de segurança, técnicas e administrativas, aptas a proteger os dados pessoais de acessos não autorizados e de situações acidentais ou ilícitas de destruição, perda, alteração, comunicação ou qualquer forma de tratamento inadequado ou ilícito;
VI - processos e políticas internas que assegurem o cumprimento da Lei nº 13.709, de 14 de agosto de 2018, e dos regulamentos e orientações da ANPD;
VII - instrumentos contratuais que disciplinem questões relacionadas ao tratamento de dados pessoais;
VIII - transferências internacionais de dados;
IX - regras de boas práticas e de governança e de programa de governança em privacidade, nos termos do art. 50 da Lei nº 13.709, de 14 de agosto de 2018;
X - produtos e serviços que adotem padrões de design compatíveis com os princípios previstos na LGPD, incluindo a privacidade por padrão e a limitação da coleta de dados pessoais ao mínimo necessário para a realização de suas finalidades; e
XI - outras atividades e tomada de decisões estratégicas referentes ao tratamento de dados pessoais.`,
  },
  {
    id: "anpd-res-18-2024-art-17",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 18/2024, art. 17",
    text: `Art. 17. O desempenho das atividades e das atribuições dispostas nos arts. 15 e 16 não confere ao encarregado a responsabilidade, perante a ANPD, pela conformidade do tratamento dos dados pessoais realizado pelo controlador.`,
  },
  {
    id: "anpd-res-18-2024-art-18",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 18/2024, art. 18",
    text: `Art. 18. O encarregado deverá atuar com ética, integridade e autonomia técnica, evitando situações que possam configurar conflito de interesse.`,
  },
  {
    id: "anpd-res-18-2024-art-19",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 18/2024, art. 19",
    text: `Art. 19. O encarregado poderá acumular funções e exercer as suas atividades para mais de um agente de tratamento, desde que seja possível o pleno atendimento de suas atribuições relacionadas a cada agente de tratamento e inexista conflito de interesse.
§ 1º O conflito de interesse pode se configurar:
I - entre as atribuições exercidas internamente em um agente de tratamento ou no exercício da atividade de encarregado em agentes de tratamento distintos; ou
II - com o acúmulo das atividades de encarregado com outras que envolvam a tomada de decisões estratégicas sobre o tratamento de dados pessoais pelo controlador, ressalvadas as operações com dados pessoais inerentes às atribuições do encarregado.
§ 2º A existência de conflito de interesse será objeto de verificação no caso concreto e poderá ensejar a aplicação de sanção ao agente de tratamento nos termos do art. 52 da Lei nº 13.709, de 14 de agosto de 2018.`,
  },
  {
    id: "anpd-res-18-2024-art-20",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 18/2024, art. 20",
    text: `Art. 20. O encarregado deverá declarar ao agente de tratamento qualquer situação que possa configurar conflito de interesse, responsabilizando-se pela veracidade das informações prestadas.`,
  },
  {
    id: "anpd-res-18-2024-art-21",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 18/2024, art. 21",
    text: `Art. 21. O agente de tratamento deve atentar para que o encarregado não exerça atribuições que acarretem conflito de interesse.
Parágrafo único. Uma vez constatada a possibilidade de conflito de interesse, o agente de tratamento deverá adotar as seguintes providências, conforme o caso:
I - não indicar a pessoa para exercer a função de encarregado;
II - implementar medidas para afastar o risco de conflito de interesse; ou
III - substituir a pessoa designada para exercer a função de encarregado.`,
  },
  {
    id: "anpd-res-4-2023-art-1",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 4/2023, art. 1º",
    text: `Art. 1º Este Regulamento tem por objetivo estabelecer parâmetros e critérios para aplicação de sanções administrativas pela Autoridade Nacional de Proteção de Dados (ANPD), bem como as formas e dosimetrias para o cálculo do valor-base das sanções de multa.`,
  },
  {
    id: "anpd-res-4-2023-art-2",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 4/2023, art. 2º",
    text: `Art. 2º Para fins deste Regulamento adotam-se as seguintes definições:
I - grupo ou conglomerado de empresas: conjunto de empresas de fato ou de direito com personalidades jurídicas próprias, sob direção, controle ou administração de uma pessoa natural ou jurídica ou ainda grupo de pessoas que detêm, isolada ou conjuntamente, poder de controle sobre as demais, desde que demonstrado interesse integrado, efetiva comunhão de interesses e atuação conjunta das empresas dele integrantes;
II - infração: descumprimento de obrigação estabelecida na Lei nº 13.709, de 14 de agosto de 2018 (LGPD), e nos regulamentos expedidos pela ANPD;
III - infração permanente: conduta infrativa que se prolonga no tempo, mediante ação ou omissão do infrator referente ao mesmo dispositivo normativo;
IV - infrator: agente de tratamento que comete infração;
V - medidas corretivas: medidas determinadas pela ANPD com a finalidade de corrigir a infração e reconduzir o infrator à plena conformidade à LGPD e aos regulamentos expedidos pela ANPD, devendo ser aplicadas conjuntamente com a sanção de advertência, nos termos deste Regulamento;
VI - política de boas práticas e de governança: normas e processos internos que assegurem o cumprimento abrangente da legislação de proteção de dados pessoais, estabelecidos e implementados pelo agente de tratamento mediante a adoção de:
a) regras de boas práticas e de governança, nos termos do art. 50, caput e § 1º, da LGPD; ou
b) programa de governança em privacidade, nos termos do § 2º do art. 50 da LGPD;
VII - ramo de atividade empresarial: área de atuação de empresa, grupo ou conglomerado de empresas, conforme definido pela ANPD e verificado no caso concreto, podendo ser comprovada mediante objeto social, código de Classificação Nacional de Atividades Econômicas (CNAE), código de serviço diretamente relacionado, ou instrumentos congêneres;
VIII - reincidência específica: repetição de infração pelo mesmo infrator ao mesmo dispositivo legal ou regulamentar, no período de 5 (cinco) anos, contado do trânsito em julgado do processo administrativo sancionador, até a data do cometimento da nova infração;
IX - reincidência genérica: cometimento de infração pelo mesmo infrator, independentemente do dispositivo legal ou regulamentar, no período de 5 (cinco) anos, contado do trânsito em julgado do processo administrativo sancionador até a data do cometimento da nova infração, excluído o disposto no inciso VIII do caput; e
X - trânsito em julgado: atributo de decisão definitiva proferida em processo administrativo sancionador, no âmbito da ANPD, tornando-a imutável e indiscutível dentro do processo em que foi proferida.`,
  },
  {
    id: "anpd-res-4-2023-art-3",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 4/2023, art. 3º",
    text: `Art. 3º As infrações sujeitarão o infrator às seguintes sanções administrativas:
I - advertência, nos termos do art. 9º deste Regulamento;
II - multa simples, nos termos dos arts. 10 a 15 deste Regulamento;
III - multa diária, nos termos do art. 16 deste Regulamento;
IV - publicização da infração, após devidamente apurada e confirmada a sua ocorrência, nos termos dos arts. 20 e 21 deste Regulamento;
V - bloqueio dos dados pessoais a que se refere a infração, até a sua regularização, nos termos do art. 22 deste Regulamento;
VI - eliminação dos dados pessoais a que se refere a infração, nos termos do art. 23 deste Regulamento;
VII - suspensão parcial do funcionamento do banco de dados a que se refere a infração, nos termos do art. 24 deste Regulamento;
VIII - suspensão do exercício da atividade de tratamento dos dados pessoais a que se refere a infração, nos termos do art. 25 deste Regulamento; e
IX - proibição parcial ou total do exercício de atividades relacionadas a tratamento de dados, nos termos do art. 26 deste Regulamento.
§ 1º As sanções previstas nos incisos VII, VIII e IX do caput deste artigo somente serão aplicadas após já ter sido imposta ao menos uma das sanções de que tratam os incisos II, III, IV, V e VI do caput deste artigo para o mesmo caso concreto.
§ 2º Na hipótese do § 1º deste artigo, a ANPD dará ciência ao principal órgão ou entidade reguladora setorial, com competências sancionatórias, a que se submete o controlador, durante a fase de instrução, para que se manifeste sobre eventuais consequências da imposição das sanções para o exercício de atividades econômicas reguladas desenvolvidas pelo controlador, especialmente na prestação de serviços públicos, assim como forneça outras informações que entender pertinentes.
§ 3º O órgão ou entidade reguladora setorial terá prazo de até 20 (vinte) dias úteis, prorrogável uma única vez por igual período, após o qual o processo poderá ter prosseguimento e ser decidido mesmo sem a manifestação.
§ 4º O infrator poderá se manifestar sobre as informações apresentadas pelo órgão ou entidade reguladora setorial em suas alegações finais.
§ 5º O disposto nos incisos I e IV a IX, do caput deste artigo, poderá ser aplicado às entidades e aos órgãos públicos, sem prejuízo do disposto na Lei nº 8.112, de 11 de dezembro de 1990, na Lei nº 8.429, de 2 de junho de 1992, e na Lei nº 12.527, de 18 de novembro de 2011.`,
  },
  {
    id: "anpd-res-4-2023-art-4",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 4/2023, art. 4º",
    text: `Art. 4º As sanções serão aplicadas após procedimento administrativo mediante decisão fundamentada da ANPD, assegurado o direito à ampla defesa, ao contraditório e ao devido processo legal, nos termos da Lei nº 9.784, de 29 de janeiro de 1999, da LGPD, do Regimento Interno da ANPD, e do Regulamento do Processo de Fiscalização e do Processo Administrativo Sancionador, aprovado pela Resolução CD/ANPD nº 1, de 28 de outubro de 2021.
Parágrafo único. Em caso de pluralidade de infratores, as sanções serão aplicadas de forma individualizada.`,
  },
  {
    id: "anpd-res-4-2023-art-5",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 4/2023, art. 5º",
    text: `Art. 5º As sanções serão aplicadas de forma gradativa, isolada ou cumulativamente, de acordo com as peculiaridades do caso concreto e nos termos deste Regulamento.
§ 1º A aplicação de sanção não exclui a possibilidade de adoção de outras medidas administrativas pela ANPD, previstas na LGPD, e no Regulamento do Processo de Fiscalização e do Processo Administrativo Sancionador, aprovado pela Resolução CD/ANPD nº 1, de 28 de outubro de 2021, e nas demais disposições legais e regulamentares em vigor, para garantir a conformidade do infrator à legislação de proteção de dados pessoais.
§ 2º O não cumprimento da sanção aplicada ou a ausência de regularização da conduta, no prazo estipulado, ensejará a progressão da atuação da ANPD para a aplicação de sanções mais graves, sem prejuízo da adoção das demais medidas legais cabíveis.`,
  },
  {
    id: "anpd-res-4-2023-art-7",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 4/2023, art. 7º",
    text: `Art. 7º Na definição da sanção, devem ser considerados os seguintes parâmetros e critérios:
I - a gravidade e a natureza das infrações e dos direitos pessoais afetados;
II - a boa-fé do infrator;
III - a vantagem auferida ou pretendida pelo infrator;
IV - a condição econômica do infrator;
V - a reincidência específica;
VI - a reincidência genérica;
VII - o grau do dano, nos termos do Apêndice I deste Regulamento;
VIII - a cooperação do infrator;
IX - a adoção reiterada e demonstrada de mecanismos e procedimentos internos capazes de minimizar o dano, voltados ao tratamento seguro e adequado de dados, em consonância com a LGPD;
X - a adoção de política de boas práticas e governança;
XI - a pronta adoção de medidas corretivas; e
XII - a proporcionalidade entre a gravidade da falta e a intensidade da sanção.`,
  },
  {
    id: "anpd-res-4-2023-art-8",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 4/2023, art. 8º",
    text: `Art. 8º As infrações são classificadas, segundo a gravidade e a natureza das infrações e dos direitos pessoais afetados, em:
I - leve;
II - média; ou
III - grave.
§ 1º A infração será considerada leve quando não verificada nenhuma das hipóteses relacionadas nos §§ 2º ou 3º deste artigo.
§ 2º A infração será considerada média quando puder afetar significativamente interesses e direitos fundamentais dos titulares de dados pessoais, caracterizada nas situações em que a atividade de tratamento puder impedir ou limitar, de maneira significativa, o exercício de direitos ou a utilização de um serviço, assim como ocasionar danos materiais ou morais aos titulares, tais como discriminação; violação à integridade física; ao direito à imagem e à reputação; fraudes financeiras ou uso indevido de identidade, desde que não seja classificada como grave.
§ 3º A infração será considerada grave quando:
I - verificada a hipótese estabelecida no § 2º deste artigo e cumulativamente, pelo menos, uma das seguintes:
a) envolver tratamento de dados pessoais em larga escala, caracterizado quando abranger número significativo de titulares, considerando-se, ainda, o volume de dados envolvidos, bem como a duração, a frequência e a extensão geográfica do tratamento realizado;
b) o infrator auferir ou pretender auferir vantagem econômica em decorrência da infração cometida;
c) a infração implicar risco à vida dos titulares;
d) a infração envolver tratamento de dados sensíveis ou de dados pessoais de crianças, de adolescentes ou de idosos;
e) o infrator realizar tratamento de dados pessoais sem amparo em uma das hipóteses legais previstas na LGPD;
f) o infrator realizar tratamento com efeitos discriminatórios ilícitos ou abusivos; ou
g) verificada a adoção sistemática de práticas irregulares pelo infrator;
II - constituir obstrução à atividade de fiscalização.`,
  },
  {
    id: "anpd-res-4-2023-art-9",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 4/2023, art. 9º",
    text: `Art. 9º A ANPD poderá aplicar a sanção de advertência quando:
I - a infração for leve ou média e não caracterizar reincidência específica; ou
II - houver necessidade de imposição de medidas corretivas.`,
  },
  {
    id: "anpd-res-4-2023-art-10",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 4/2023, art. 10",
    text: `Art. 10. A ANPD aplicará a sanção de multa simples quando:
I - o infrator não tenha atendido as medidas preventivas ou corretivas a ele impostas, dentro dos prazos estabelecidos, quando aplicável;
II - a infração for classificada como grave; ou
III - pela natureza da infração, da atividade de tratamento ou dos dados pessoais, e pelas circunstâncias do caso concreto, não for adequado aplicar outra sanção.`,
  },
  {
    id: "anpd-res-4-2023-art-12",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 4/2023, art. 12",
    text: `Art. 12. O valor da multa simples será acrescido nos percentuais abaixo, caso incidam as seguintes circunstâncias agravantes:
I - 10% (dez por cento) para cada caso de reincidência específica, até o limite de 40% (quarenta por cento);
II - 5% (cinco por cento) para cada caso de reincidência genérica, até o limite de 20% (vinte por cento);
III - 20% (vinte por cento) para cada medida de orientação ou preventiva descumprida no processo de fiscalização ou do procedimento preparatório que precedeu o processo administrativo sancionador, até o limite de 80% (oitenta por cento); e
IV - 30% (trinta por cento) para cada medida corretiva descumprida, até o limite de 90% (noventa por cento).
§ 1º Na hipótese de incidência de mais de um dos incisos deste artigo, deverão ser somados os percentuais relativos a cada fator.
§ 2º Na hipótese de haver registros computáveis a título de reincidência específica além do suficiente para a incidência do percentual máximo de agravamento previsto no inciso I deste artigo, os excedentes ingressarão na categoria de reincidência genérica, para o acréscimo previsto no inciso II.`,
  },
  {
    id: "anpd-res-4-2023-art-13",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 4/2023, art. 13",
    text: `Art. 13. O valor da multa simples será reduzido, nos percentuais abaixo, caso incidam as seguintes circunstâncias atenuantes:
I - nos casos de cessação da infração:
a) 75% (setenta e cinco por cento), se previamente à instauração de procedimento preparatório pela ANPD;
b) 50% (cinquenta por cento), se após a instauração de procedimento preparatório e até a instauração de processo administrativo sancionador; ou
c) 30% (trinta por cento), se após a instauração de processo administrativo sancionador e até a prolação da decisão de primeira instância no âmbito do processo administrativo sancionador;
II - 20% (vinte por cento), nos casos de implementação de política de boas práticas e de governança ou de adoção reiterada e demonstrada de mecanismos e procedimentos internos capazes de minimizar os danos aos titulares, voltados ao tratamento seguro e adequado de dados, até a prolação da decisão de primeira instância no âmbito do processo administrativo sancionador;
III - nos casos em que o infrator tenha comprovado a implementação de medidas capazes de reverter ou mitigar os efeitos da infração sobre os titulares de dados pessoais afetados:
a) 20% (vinte por cento), previamente à instauração de procedimento preparatório ou processo administrativo sancionador pela ANPD; ou
b) 10% (dez por cento), se após a instauração de procedimento preparatório e até a instauração de processo administrativo sancionador; e
IV - 5% (cinco por cento), nos casos em que se verifique a cooperação ou boa-fé por parte do infrator.
§ 1º Para efeitos dos incisos I e III deste artigo, não serão consideradas atenuantes a cessação da infração e a adoção de medidas capazes de reverter ou mitigar os efeitos da infração decorrentes do mero cumprimento de determinação administrativa ou judicial.
§ 2º Na hipótese de incidência de mais de um dos incisos deste artigo, deverão ser somados os percentuais relativos a cada fator.
§ 3º Cabe ao infrator o ônus de comprovar perante a ANPD o cumprimento dos requisitos previstos neste artigo.`,
  },
  {
    id: "anpd-res-19-2024-art-1",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 19/2024, art. 1º",
    text: `Art. 1º Este Regulamento estabelece os procedimentos e as regras aplicáveis às operações de transferência internacional de dados:
I - para países ou organismos internacionais que proporcionem grau de proteção de dados pessoais adequado ao previsto na Lei nº 13.709, de 14 de agosto de 2018, mediante reconhecimento da adequação pela ANPD; ou
II - quando controlador oferecer e comprovar garantias de cumprimento dos princípios, dos direitos do titular e do regime de proteção de dados previstos na Lei nº 13.709, de 14 de agosto de 2018, na forma de:
a) cláusulas contratuais específicas para determinada transferência;
b) cláusulas-padrão contratuais; ou
c) normas corporativas globais.
Parágrafo único. O disposto neste Regulamento não exclui a possibilidade da realização de transferência internacional de dados com base nos demais mecanismos previstos no art. 33 da Lei nº 13.709, de 14 de agosto de 2018, que não dependam de regulamentação, desde que atendidas as especificidades do caso concreto e os requisitos legais aplicáveis.`,
  },
  {
    id: "anpd-res-19-2024-art-2",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 19/2024, art. 2º",
    text: `Art. 2º A transferência internacional de dados será realizada em conformidade com o disposto na Lei nº 13.709, de 14 de agosto de 2018, e neste Regulamento, observadas as seguintes diretrizes:
I - garantia de cumprimento dos princípios, dos direitos do titular e de nível de proteção equivalente ao previsto na legislação nacional, independentemente do país onde estejam localizados os dados pessoais objeto da transferência, inclusive após o término do tratamento e nas hipóteses de transferências posteriores;
II - adoção de procedimentos simples, preferencialmente interoperáveis, e compatíveis com normas e boas práticas internacionais;
III - promoção do livre fluxo transfronteiriço de dados com confiança e do desenvolvimento social, econômico e tecnológico, com observância aos direitos dos titulares;
IV - responsabilização e prestação de contas, mediante a adoção de medidas eficazes e capazes de comprovar a observância e o cumprimento dos princípios dos direitos do titular e do regime de proteção de dados pessoais previstos na Lei nº 13.709, de 14 de agosto de 2018, inclusive, da eficácia dessas medidas;
V - implementação de medidas efetivas de transparência, que assegurem o fornecimento aos titulares de informações claras, precisas e facilmente acessíveis sobre a realização da transferência, observados os segredos comercial e industrial; e
VI - adoção de boas práticas e de medidas de prevenção e segurança apropriadas e compatíveis com a natureza dos dados pessoais tratados, a finalidade do tratamento e os riscos envolvidos na operação.`,
  },
  {
    id: "anpd-res-19-2024-art-3",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 19/2024, art. 3º",
    text: `Art. 3º Para efeitos deste Regulamento são adotadas as seguintes definições:
I - exportador: agente de tratamento, localizado no território nacional ou em país estrangeiro, que transfere dados pessoais para importador;
II - importador: agente de tratamento, localizado em país estrangeiro ou que seja organismo internacional, que recebe dados pessoais transferidos por exportador;
III - transferência: operação de tratamento por meio da qual um agente de tratamento transmite, compartilha ou disponibiliza acesso a dados pessoais a outro agente de tratamento;
IV - transferência internacional de dados: transferência de dados pessoais para país estrangeiro ou organismo internacional do qual o país seja membro;
V - coleta internacional de dados: coleta de dados pessoais do titular efetuada diretamente pelo agente de tratamento localizado no exterior;
VI - grupo ou conglomerado de empresas: conjunto de empresas de fato ou de direito com personalidades jurídicas próprias, sob direção, controle ou administração de uma pessoa natural ou jurídica ou ainda grupo de pessoas que detêm, isolada ou conjuntamente, poder de controle sobre as demais, desde que demonstrado interesse integrado, efetiva comunhão de interesses e atuação conjunta das empresas dele integrantes;
VII - entidade responsável: sociedade empresária, com sede no Brasil, que responde por qualquer violação de norma corporativa global, ainda que decorrente de ato praticado por um membro do grupo ou conglomerado de empresas com sede em outro país;
VIII - mecanismos de transferência internacional de dados: hipóteses previstas nos incisos I a IX do art. 33 da Lei nº 13.709, de 14 de agosto de 2018, que autorizam uma transferência internacional de dados;
IX - organismo internacional: organização regida pelo direito internacional público, incluindo seus órgãos subordinados ou qualquer outro órgão criado mediante acordo firmado entre dois ou mais países; e
X - medidas de segurança: medidas técnicas e administrativas adotadas para proteger os dados pessoais de acessos não autorizados e de situações acidentais ou ilícitas de destruição, perda, alteração, comunicação ou difusão.`,
  },
  {
    id: "anpd-res-19-2024-art-4",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 19/2024, art. 4º",
    text: `Art. 4º Cabe ao controlador verificar, nos termos da Lei nº 13.709, de 14 de agosto de 2018, e deste Regulamento, se a operação de tratamento:
I - caracteriza transferência internacional de dados;
II - submete-se à legislação nacional de proteção de dados pessoais; e
III - está amparada em hipótese legal e em mecanismo de transferência internacional válidos.
§ 1º O operador prestará auxílio ao controlador mediante o fornecimento das informações de que dispuser e que se demonstrarem necessárias para o atendimento ao disposto no caput deste artigo.
§ 2º O controlador e o operador deverão adotar medidas eficazes e capazes de comprovar a observância e o cumprimento das normas de proteção de dados pessoais e da eficácia dessas medidas, de forma compatível com o grau de risco do tratamento e com o mecanismo de transferência internacional utilizado.`,
  },
  {
    id: "anpd-res-19-2024-art-5",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 19/2024, art. 5º",
    text: `Art. 5º A transferência internacional de dados será caracterizada quando o exportador transferir dados pessoais para o importador.`,
  },
  {
    id: "anpd-res-19-2024-art-6",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 19/2024, art. 6º",
    text: `Art. 6º A coleta internacional de dados não caracteriza transferência internacional de dados.
Parágrafo único. A coleta internacional de dados observará as disposições da Lei nº 13.709, de 14 de agosto de 2018, quando verificada uma das hipóteses indicadas no art. 3º da Lei.`,
  },
  {
    id: "anpd-res-19-2024-art-7",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 19/2024, art. 7º",
    text: `Art. 7º A transferência internacional de dados deverá observar as disposições da Lei nº 13.709, de 14 de agosto de 2018, e deste Regulamento, quando:
I - a operação de tratamento for realizada no território nacional, ressalvado o disposto no inciso IV do caput do art. 4º da Lei nº 13.709, de 14 de agosto de 2018, e observado o disposto no art. 8º deste Regulamento;
II - a atividade de tratamento tiver por objetivo a oferta ou o fornecimento de bens ou serviços ou o tratamento de dados de indivíduos localizados no território nacional; ou
III - os dados pessoais, objeto do tratamento, forem coletados no território nacional.
Parágrafo único. A aplicação da legislação nacional à transferência internacional de dados independe do meio utilizado para sua realização, do país de sede dos agentes de tratamento ou do país onde estejam localizados os dados.`,
  },
  {
    id: "anpd-res-19-2024-art-8",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 19/2024, art. 8º",
    text: `Art. 8º Aplica-se a Lei nº 13.709, de 14 de agosto de 2018, aos dados pessoais provenientes do exterior sempre que estes sejam objeto de tratamento no território nacional.
§ 1º A Lei nº 13.709, de 14 de agosto de 2018, não se aplica aos dados pessoais provenientes do exterior somente quando ocorrer:
I - trânsito de dados pessoais, sem a ocorrência de comunicação ou uso compartilhado de dados com agente de tratamento situado em território nacional; ou
II - retorno dos dados pessoais, objeto de tratamento no território nacional, exclusivamente ao país ou organismo internacional de proveniência, desde que:
a) o país ou organismo internacional de proveniência proporcione grau de proteção de dados pessoais adequado, reconhecido por decisão da ANPD;
b) a legislação do país ou as normas aplicáveis ao organismo internacional de proveniência se apliquem à operação realizada; e
c) a situação específica e excepcional de não aplicação da Lei nº 13.709, de 14 de agosto de 2018, esteja expressamente prevista na decisão de adequação referida na alínea "a".
§ 2º Para fins do inciso II do § 1º, a decisão de adequação emitida pela ANPD não excepcionará a aplicação da Lei nº 13.709, de 14 de agosto de 2018, em situações que possam violar ou colocar em risco a observância dos princípios gerais de proteção de dados pessoais e os direitos dos titulares previstos na legislação nacional.
§ 3º A não aplicação da Lei nº 13.709, de 14 de agosto de 2018, nas hipóteses previstas neste artigo não afasta a necessidade de observância de outras leis ou regulamentos, especialmente os que dispõem sobre inviolabilidade e sigilo das comunicações, requisitos técnicos e de segurança e acesso a dados por autoridades públicas.`,
  },
  {
    id: "anpd-res-19-2024-art-9",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 19/2024, art. 9º",
    text: `Art. 9º A transferência internacional de dados somente poderá ser realizada para atender a propósitos legítimos, específicos, explícitos e informados ao titular, sem possibilidade de tratamento posterior de forma incompatível com essas finalidades, e desde que amparada em:
I - uma das hipóteses legais previstas no art. 7º ou no art. 11 da Lei nº 13.709, de 14 de agosto de 2018; e
II - um dos seguintes mecanismos válidos de realização da transferência internacional:
a) para países ou organismos internacionais que proporcionem grau de proteção de dados pessoais adequado ao previsto na Lei nº 13.709, de 14 de agosto de 2018, e em normas complementares, conforme reconhecido por decisão de adequação emitida pela ANPD;
b) cláusulas-padrão contratuais, normas corporativas globais ou cláusulas contratuais específicas, na forma deste Regulamento; ou
c) nas hipóteses previstas nos incisos II, "d", e III a IX do art. 33 da Lei nº 13.709, de 14 de agosto de 2018.
Parágrafo único. A transferência internacional de dados deverá se limitar ao mínimo necessário para o alcance de suas finalidades, com abrangência dos dados pertinentes, proporcionais e não excessivos em relação às finalidades do tratamento de dados.`,
  },
  {
    id: "anpd-res-19-2024-art-15",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 19/2024, art. 15",
    text: `Art. 15. As cláusulas-padrão contratuais, elaboradas e aprovadas pela ANPD na forma do Anexo II, estabelecem garantias mínimas e condições válidas para a realização de transferências internacionais de dados baseadas no inciso II, alínea "b", do art. 33 da Lei nº 13.709, de 14 de agosto de 2018.
Parágrafo único. As cláusulas-padrão contratuais visam garantir a adoção das salvaguardas adequadas para o cumprimento dos princípios, dos direitos do titular e do regime de proteção de dados previstos na Lei nº 13.709, de 14 de agosto de 2018, incluindo as determinações da ANPD.`,
  },
  {
    id: "anpd-res-19-2024-art-16",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 19/2024, art. 16",
    text: `Art. 16. A validade da transferência internacional de dados, quando amparada na adoção das cláusulas-padrão, pressupõe a adoção integral e sem alteração do texto disponibilizado no Anexo II, mediante instrumento contratual firmado entre o exportador e o importador.
§ 1º As cláusulas-padrão contratuais poderão integrar:
I - contrato celebrado para reger especificamente transferências internacionais de dados;
II - contrato com objeto mais amplo, inclusive mediante a assinatura de termo aditivo pelo exportador e pelo importador envolvidos na operação de transferência internacional de dados.
§ 2º As demais disposições, previstas no instrumento contratual ou em contratos coligados firmados pelas partes, não poderão excluir, modificar ou contrariar, direta ou indiretamente, o disposto nas cláusulas-padrão contratuais.
§ 3º Na hipótese do inciso II do § 1º deste artigo, as Seções I, II e III do Anexo II deverão figurar como documento anexo do instrumento contratual assinado entre exportador e importador.`,
  },
  {
    id: "anpd-res-19-2024-art-17",
    source: "anpd",
    citation: "Resolução CD/ANPD nº 19/2024, art. 17",
    text: `Art. 17. O controlador deverá disponibilizar ao titular, em caso de solicitação, a íntegra das cláusulas utilizadas para a realização da transferência internacional de dados, observados os segredos comercial e industrial.
§ 1º O prazo para atendimento da solicitação é de 15 (quinze) dias, ressalvada a hipótese de prazo distinto estabelecido em regulamentação específica da ANPD.
§ 2º O controlador deverá ainda publicar em sua página na Internet documento contendo informações em língua portuguesa, em linguagem simples, clara, precisa e acessível sobre a realização da transferência internacional de dados, incluindo, pelo menos, informações sobre:
I - a forma, a duração e a finalidade específica da transferência internacional;
II - o país de destino dos dados transferidos;
III - a identificação e os contatos do controlador;
IV - o uso compartilhado de dados pelo controlador e a finalidade;
V - as responsabilidades dos agentes que realizarão o tratamento e as medidas de segurança adotadas; e
VI - os direitos do titular e os meios para o seu exercício, incluindo canal de fácil acesso e o direito de peticionar contra o controlador perante a ANPD.
§ 3º O documento referido no § 2º poderá ser disponibilizado em página específica ou integrado, de forma destacada e de fácil acesso, à Política de Privacidade ou a instrumento equivalente.`,
  },
];
