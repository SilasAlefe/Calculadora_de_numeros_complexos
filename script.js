function mostrar(msg, isError = false) {
    const consoleDiv = document.getElementById('console');
    const line = document.createElement('div');
    line.textContent = "> " + msg;
    if (isError) line.className = "error";
    consoleDiv.appendChild(line);
    consoleDiv.scrollTop = consoleDiv.scrollHeight;
}

let memoriaVariaveis = {}; 

function iniciarCalculo() {
    const exprTexto = document.getElementById('expressao').value;
    if (!exprTexto.trim()) {
        mostrar("Por favor, digite uma expressão.", true);
        return;
    }

    memoriaVariaveis = {}; 

    try {
        mostrar("--- Nova Execução ---");
        mostrar("Analisando: " + exprTexto);
        
        let parser = new Parser(exprTexto);
        let arvore = parser.parse();

        desenharArvore(arvore);

        mostrar("Executando árvore...");
        let resultado = executarArvore(arvore, memoriaVariaveis);
        
        mostrar("RESULTADO FINAL: " + resultado.toString());

    } catch (e) {
        mostrar("ERRO: " + e.message, true);
    }
}


function verificarIgualdade() {
    const exp1 = prompt("Expressão 1:");
    const exp2 = prompt("Expressão 2:");
    if(!exp1 || !exp2) return;

    try {
        let contextoComparacao = { __isComparison: true };

        let p1 = new Parser(exp1); let t1 = p1.parse();
        let p2 = new Parser(exp2); let t2 = p2.parse();
        
        let r1 = executarArvore(t1, contextoComparacao);
        let r2 = executarArvore(t2, contextoComparacao);

        let diff = Math.abs(r1.real - r2.real) + Math.abs(r1.imag - r2.imag);
        if (diff < 0.001) mostrar(`As expressões são EQUIVALENTES. Res: ${r1.toString()}`);
        else mostrar(`As expressões são DIFERENTES. (${r1.toString()} vs ${r2.toString()})`, true);

    } catch (e) {
        mostrar("Erro na comparação: " + e.message, true);
    }
}

function limpar() {
    document.getElementById('console').innerHTML = "Pronto.";
    document.getElementById('expressao').value = "";
    document.getElementById('tree-view').innerHTML = "<span style='color:#888'>Nenhuma árvore.</span>";
    memoriaVariaveis = {};
}

class Complexo {
    constructor(real, imag) {
        this.real = parseFloat(real);
        this.imag = parseFloat(imag);
        if (isNaN(this.real)) this.real = 0;
        if (isNaN(this.imag)) this.imag = 0;
    }

    toString() {
        let sinal = this.imag >= 0 ? '+' : '-';
        let imagAbs = Math.abs(this.imag);
        let r = Math.round(this.real * 10000) / 10000;
        let i = Math.round(imagAbs * 10000) / 10000;
        return `${r} ${sinal} ${i}i`;
    }

    somar(outro) { return new Complexo(this.real + outro.real, this.imag + outro.imag); }
    subtrair(outro) { return new Complexo(this.real - outro.real, this.imag - outro.imag); }
    
    multiplicar(outro) {
        let real = (this.real * outro.real) - (this.imag * outro.imag);
        let imag = (this.real * outro.imag) + (this.imag * outro.real);
        return new Complexo(real, imag);
    }

    dividir(outro) {
        let denominador = (outro.real * outro.real) + (outro.imag * outro.imag);
        if (denominador === 0) throw new Error("Erro Matemático: Divisão por zero!");
        let real = ((this.real * outro.real) + (this.imag * outro.imag)) / denominador;
        let imag = ((this.imag * outro.real) - (this.real * outro.imag)) / denominador;
        return new Complexo(real, imag);
    }

    conjugado() { return new Complexo(this.real, -this.imag); }

    potencia(n) {
            if (typeof n !== 'number') n = n.real; 
            let r = Math.sqrt(this.real**2 + this.imag**2);
            let theta = Math.atan2(this.imag, this.real);
            let novoR = Math.pow(r, n);
            let novoTheta = n * theta;
            return new Complexo(novoR * Math.cos(novoTheta), novoR * Math.sin(novoTheta));
    }
    
    raiz() { return this.potencia(0.5); }
}

class NoArvore {
    constructor(valor, tipo, esquerda = null, direita = null) {
        this.valor = valor;
        this.tipo = tipo;
        this.esquerda = esquerda;
        this.direita = direita;
    }
}

class Parser {
    constructor(expressao) {
        this.variaveisEncontradas = new Set();
        this.tokens = this.tokenizar(expressao);
        this.posicao = 0;
    }

    tokenizar(expressao) {
        let tokens = [];
        let limpa = expressao.replace(/\s+/g, '');
        let i = 0;
        while(i < limpa.length) {
            let char = limpa[i];
            if (/\d/.test(char)) {
                let numStr = char;
                i++;
                while(i < limpa.length && (/[\d\.]/.test(limpa[i]))) {
                    numStr += limpa[i];
                    i++;
                }
                if (i < limpa.length && limpa[i] === 'i') {
                        tokens.push({ tipo: 'NUMERO_IMAG', valor: parseFloat(numStr) });
                        i++;
                } else {
                    tokens.push({ tipo: 'NUMERO_REAL', valor: parseFloat(numStr) });
                }
            } 
            else if (/[a-zA-Z]/.test(char)) {
                let varName = char;
                i++;
                while(i < limpa.length && /[a-zA-Z0-9]/.test(limpa[i])) {
                        varName += limpa[i];
                        i++;
                }
                if (varName === 'i') {
                    tokens.push({ tipo: 'NUMERO_IMAG', valor: 1 });
                } else if (varName === 'conjugado' || varName === 'raiz') {
                    tokens.push({ tipo: 'FUNCAO', valor: varName });
                } else {
                    tokens.push({ tipo: 'VARIAVEL', valor: varName });
                    this.variaveisEncontradas.add(varName);
                }
            }
            else if (char === '*' && limpa[i+1] === '*') {
                tokens.push({ tipo: 'OPERADOR', valor: '**' });
                i += 2;
            }
            else if ("+-*/()".includes(char)) {
                tokens.push({ tipo: 'OPERADOR', valor: char });
                i++;
            }
            else {
                throw new Error("Caractere inválido: " + char);
            }
        }
        return tokens;
    }

    parse() {
        let ast = this.parseExpression();
        if (this.posicao < this.tokens.length) throw new Error("Expressão incompleta.");
        return ast;
    }
    
    peek() { return this.tokens[this.posicao]; }
    consumir() { return this.tokens[this.posicao++]; }

    parseExpression() {
        let no = this.parseTerm();
        while (this.posicao < this.tokens.length) {
            let token = this.peek();
            if (token.tipo === 'OPERADOR' && (token.valor === '+' || token.valor === '-')) {
                this.consumir();
                no = new NoArvore(token.valor, 'OPERADOR', no, this.parseTerm());
            } else break;
        }
        return no;
    }

    parseTerm() {
        let no = this.parseFactor();
        while (this.posicao < this.tokens.length) {
            let token = this.peek();
            if (token.tipo === 'OPERADOR' && (token.valor === '*' || token.valor === '/')) {
                this.consumir();
                no = new NoArvore(token.valor, 'OPERADOR', no, this.parseFactor());
            } else break;
        }
        return no;
    }

    parseFactor() {
        let no = this.parseUnary();
        
        if (this.posicao < this.tokens.length) {
            let token = this.peek();
            if (token.tipo === 'OPERADOR' && token.valor === '**') {
                this.consumir();
                no = new NoArvore('**', 'OPERADOR', no, this.parseFactor());
            }
        }
        return no;
    }

    parseUnary() {
        if (this.posicao < this.tokens.length) {
            let token = this.peek();
            if (token.tipo === 'OPERADOR' && token.valor === '-') {
                this.consumir(); 
                let direita = this.parseUnary();
                return new NoArvore('-', 'OPERADOR', new NoArvore(new Complexo(0, 0), 'NUMERO'), direita);
            }
            if (token.tipo === 'OPERADOR' && token.valor === '+') {
                this.consumir();
                return this.parseUnary();
            }
        }
        return this.parseBase();
    }

    parseBase() {
        if (this.posicao >= this.tokens.length) throw new Error("Fim inesperado da expressão.");
        let token = this.consumir();

        if (token.tipo === 'NUMERO_REAL') return new NoArvore(new Complexo(token.valor, 0), 'NUMERO');
        if (token.tipo === 'NUMERO_IMAG') return new NoArvore(new Complexo(0, token.valor), 'NUMERO');
        if (token.tipo === 'VARIAVEL') return new NoArvore(token.valor, 'VARIAVEL');
        if (token.tipo === 'FUNCAO') {
            this.consumir(); 
            let arg = this.parseExpression();
            this.consumir(); 
            return new NoArvore(token.valor, 'FUNCAO', arg, null);
        }
        if (token.tipo === 'OPERADOR' && token.valor === '(') {
            let no = this.parseExpression();
            if (this.posicao >= this.tokens.length || this.peek().valor !== ')') {
                throw new Error("Parênteses não fechados.");
            }
            this.consumir(); 
            return no;
        }
        throw new Error("Token inesperado: " + token.valor);
    }
}

function executarArvore(no, contexto) {
    if (!no) return new Complexo(0, 0);

    if (no.tipo === 'NUMERO') {
        return no.valor;
    }

    if (no.tipo === 'VARIAVEL') {
        if (contexto && contexto.__isComparison) return new Complexo(1, 1);

        if (contexto[no.valor]) {
            return contexto[no.valor];
        }

        let entrada = prompt(`Execução em Andamento.\n\nA variável '${no.valor}' foi encontrada.\nPor favor, digite o valor (ex: 3+2i ou 5):`);
        
        if (entrada === null) throw new Error("Execução cancelada pelo usuário.");
        if (entrada.trim() === "") throw new Error("Valor vazio para variável " + no.valor);

        try {
            let parserVar = new Parser(entrada);
            let arvoreVar = parserVar.parse();
            let valorCalculado = executarArvore(arvoreVar, {});
            
            contexto[no.valor] = valorCalculado;
            
            mostrar(`Variável definida: ${no.valor} = ${valorCalculado.toString()}`);
            return valorCalculado;

        } catch (e) {
            throw new Error(`Valor inválido digitado para '${no.valor}': ${e.message}`);
        }
    }

    if (no.tipo === 'FUNCAO') {
        let arg = executarArvore(no.esquerda, contexto);
        if (no.valor === 'conjugado') return arg.conjugado();
        if (no.valor === 'raiz') return arg.raiz();
    }

    if (no.tipo === 'OPERADOR') {
        let esq = executarArvore(no.esquerda, contexto);
        let dir = executarArvore(no.direita, contexto);

        switch (no.valor) {
            case '+': return esq.somar(dir);
            case '-': return esq.subtrair(dir);
            case '*': return esq.multiplicar(dir);
            case '/': return esq.dividir(dir);
            case '**': return esq.potencia(dir.real);
        }
    }
    return new Complexo(0, 0);
}

function desenharArvore(raiz) {
    const container = document.getElementById('tree-view');
    container.innerHTML = '';
    if (raiz) container.appendChild(criarElementoNo(raiz));
}

function criarElementoNo(no) {
    let divNo = document.createElement('div');
    divNo.className = 'tree-node';
    let conteudo = document.createElement('div');
    conteudo.className = 'node-content';
    
    if (no.tipo === 'NUMERO') conteudo.textContent = no.valor.toString();
    else if (no.tipo === 'VARIAVEL') conteudo.textContent = "Var: " + no.valor;
    else conteudo.textContent = no.valor;

    divNo.appendChild(conteudo);

    if (no.esquerda || no.direita) {
        let divFilhos = document.createElement('div');
        divFilhos.className = 'children';
        if (no.esquerda) divFilhos.appendChild(criarElementoNo(no.esquerda));
        if (no.direita) divFilhos.appendChild(criarElementoNo(no.direita));
        divNo.appendChild(divFilhos);
    }
    return divNo;
}