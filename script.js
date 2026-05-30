// 1) Cole aqui a URL do seu Apps Script publicado como Aplicativo da Web.
const URL_SCRIPT = "https://script.google.com/macros/s/AKfycbxAqFm4inJachIlaJx6CsxbcS-zX88_V5AWuGJOkWF46BUHhDZwYk-eCEeh1RX7RgSg/exec";

// Tempo máximo do quiz em segundos. 5 minutos = 300 segundos.
const TEMPO_MAXIMO = 300;
const TOTAL_QUESTOES = 12;

let questoesSelecionadas = [];
let respostasAluno = [];
let indiceAtual = 0;
let inicioTempo = null;
let intervaloCronometro = null;
let quizFinalizado = false;

function mostrarTela(id) {
  document.querySelectorAll(".tela").forEach(t => t.classList.remove("ativa"));
  document.getElementById(id).classList.add("ativa");
}

function sortearQuestao(lista) {
  return lista[Math.floor(Math.random() * lista.length)];
}

function embaralhar(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

function iniciarQuiz() {
  const nome = document.getElementById("nome").value.trim();
  const turma = document.getElementById("turma").value;

  if (nome.length < 5) {
    alert("Digite o nome completo do aluno.");
    return;
  }

  if (!turma) {
    alert("Selecione a turma.");
    return;
  }

  const disciplinas = Object.keys(bancoQuestoes);
  questoesSelecionadas = disciplinas.map(disciplina => {
    const q = sortearQuestao(bancoQuestoes[disciplina]);
    return { ...q, disciplina };
  });

  questoesSelecionadas = embaralhar(questoesSelecionadas);
  respostasAluno = Array(questoesSelecionadas.length).fill(null);
  indiceAtual = 0;
  quizFinalizado = false;
  inicioTempo = Date.now();

  mostrarTela("tela-quiz");
  renderizarQuestao();
  iniciarCronometro();
}

function renderizarQuestao() {
  const q = questoesSelecionadas[indiceAtual];
  document.getElementById("progresso").textContent = `Questão ${indiceAtual + 1} de ${questoesSelecionadas.length}`;
  document.getElementById("disciplina").textContent = q.disciplina;
  document.getElementById("pergunta").textContent = q.pergunta;

  const alternativas = document.getElementById("alternativas");
  alternativas.innerHTML = "";

  q.alternativas.forEach((alt, i) => {
    const label = document.createElement("label");
    label.className = "alternativa";
    label.innerHTML = `<input type="radio" name="resposta" value="${i}"> ${alt}`;
    alternativas.appendChild(label);
  });
}

function proximaQuestao() {
  const marcada = document.querySelector('input[name="resposta"]:checked');

  if (!marcada) {
    alert("Selecione uma alternativa antes de continuar.");
    return;
  }

  respostasAluno[indiceAtual] = Number(marcada.value);

  if (indiceAtual < questoesSelecionadas.length - 1) {
    indiceAtual++;
    renderizarQuestao();
  } else {
    finalizarQuiz(false);
  }
}

function iniciarCronometro() {
  clearInterval(intervaloCronometro);

  intervaloCronometro = setInterval(() => {
    const tempoUsado = Math.floor((Date.now() - inicioTempo) / 1000);
    const restante = Math.max(0, TEMPO_MAXIMO - tempoUsado);
    const min = Math.floor(restante / 60);
    const seg = restante % 60;

    const cronometro = document.getElementById("cronometro");
    cronometro.textContent = `${String(min).padStart(2, "0")}:${String(seg).padStart(2, "0")}`;

    if (restante <= 60) cronometro.classList.add("alerta");

    if (restante <= 0) {
      finalizarQuiz(true);
    }
  }, 1000);
}

function calcularResultado(tempoSegundos) {
  let acertos = 0;

  questoesSelecionadas.forEach((q, i) => {
    if (respostasAluno[i] === q.correta) acertos++;
  });

  // Pontuação: acertos têm peso principal; tempo serve como bônus/desempate.
  // Cada acerto vale 100 pontos. O bônus de tempo vai de 0 a 100 pontos.
  const bonusTempo = Math.max(0, Math.round(100 * (1 - tempoSegundos / TEMPO_MAXIMO)));
  const pontuacao = (acertos * 100) + bonusTempo;

  return { acertos, bonusTempo, pontuacao };
}

async function finalizarQuiz(tempoEsgotado) {
  if (quizFinalizado) return;
  quizFinalizado = true;
  clearInterval(intervaloCronometro);

  const tempoSegundos = Math.min(TEMPO_MAXIMO, Math.floor((Date.now() - inicioTempo) / 1000));
  const resultado = calcularResultado(tempoSegundos);

  document.getElementById("res-acertos").textContent = `${resultado.acertos}/${TOTAL_QUESTOES}`;
  document.getElementById("res-tempo").textContent = formatarTempo(tempoSegundos);
  document.getElementById("res-pontos").textContent = resultado.pontuacao;

  document.getElementById("mensagem-final").textContent = tempoEsgotado
    ? "Tempo encerrado! Suas respostas preenchidas foram registradas."
    : "Parabéns! Sua participação foi registrada.";

  mostrarTela("tela-resultado");

  const dados = {
    dataISO: new Date().toISOString(),
    nome: document.getElementById("nome").value.trim(),
    turma: document.getElementById("turma").value,
    acertos: resultado.acertos,
    total: TOTAL_QUESTOES,
    tempoSegundos,
    pontuacao: resultado.pontuacao,
    bonusTempo: resultado.bonusTempo
  };

  await salvarResposta(dados);
  await carregarRankings(dados.turma);
}

async function salvarResposta(dados) {
  if (!URL_SCRIPT || URL_SCRIPT.includes("COLE_AQUI")) {
    alert("A URL do Apps Script ainda não foi configurada no arquivo script.js.");
    return;
  }

  try {
    await fetch(URL_SCRIPT, {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify(dados)
    });
  } catch (erro) {
    console.error("Erro ao salvar resposta:", erro);
  }
}

async function carregarRankings(turma) {
  try {
    const resposta = await fetch(`${URL_SCRIPT}?turma=${encodeURIComponent(turma)}`);
    const dados = await resposta.json();

    renderRanking("ranking-semana", dados.rankingSemana || []);
    renderRanking("ranking-turma", dados.rankingTurma || []);
  } catch (erro) {
    console.error("Erro ao carregar ranking:", erro);
    document.getElementById("ranking-semana").innerHTML = "<li>Ranking indisponível no momento.</li>";
    document.getElementById("ranking-turma").innerHTML = "<li>Ranking indisponível no momento.</li>";
  }
}

function renderRanking(id, lista) {
  const ol = document.getElementById(id);
  ol.innerHTML = "";

  if (!lista.length) {
    ol.innerHTML = "<li>Ainda não há registros nesta semana.</li>";
    return;
  }

  lista.forEach((item, i) => {
    const medalha = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
const li = document.createElement("li");

li.innerHTML = `
<strong>${medalha} ${item.nome}</strong>
<br>
🏫 Turma: ${item.turma}
<br>
🏆 ${item.pontuacao} pts
<br>
✅ ${item.acertos}/${item.total}
<br>
⏱ ${formatarTempo(Number(item.tempoSegundos))}
`;
    ol.appendChild(li);
  });
}

function formatarTempo(segundos) {
  const min = Math.floor(segundos / 60);
  const seg = segundos % 60;
  return `${String(min).padStart(2, "0")}:${String(seg).padStart(2, "0")}`;
}
async function carregarRankingInicial() {

  try {

    const resposta = await fetch(URL_SCRIPT);
    const dados = await resposta.json();

    const ranking = (dados.rankingSemana || []).slice(0,10);

    let html = "";

    ranking.forEach((aluno,index)=>{

      let medalha="";
      let classe="";

      if(index===0){
        medalha="🥇";
        classe="top1";
      }
      else if(index===1){
        medalha="🥈";
        classe="top2";
      }
      else if(index===2){
        medalha="🥉";
        classe="top3";
      }

      html += `
      <div class="ranking-item ${classe}">

        <div class="medalha">
          ${medalha || (index+1)+"º"}
        </div>

        <div class="nome-ranking">
          ${aluno.nome}
          <small>${aluno.turma}</small>
        </div>

        <div class="pontos-ranking">
          ${aluno.pontuacao} pts
        </div>

      </div>
      `;

    });

    document.getElementById("rankingInicial").innerHTML = html;

  }
  catch(error){

    console.error(error);

    document.getElementById("rankingInicial").innerHTML =
      "Não foi possível carregar o ranking.";

  }
}
function reiniciar() {
  document.getElementById("nome").value = "";
  document.getElementById("turma").value = "";
  document.getElementById("cronometro").classList.remove("alerta");
  mostrarTela("tela-inicio");
}
window.onload = () => {

  carregarRankingInicial();

};
