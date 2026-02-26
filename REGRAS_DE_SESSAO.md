### O PROBLEMA
Seu agente carrega 50KB de histórico a cada mensagem. Isso desperdiça de 2 a 3 milhões de tokens por sessão e custa $4 por dia. Se você está usando mensagens de terceiros ou interfaces que não possuem limpeza de sessão integrada, esse problema se agrava rapidamente.

### A Solução
Adicione esta regra de inicialização de sessão ao prompt de sistema do seu agente. Ela diz ao seu agente exatamente o que carregar (e o que NÃO carregar) no início de cada sessão:

---

### REGRA DE INICIALIZAÇÃO DE SESSÃO:

**A cada início de sessão:**

1.  **Carregue APENAS estes arquivos:**
    *   `SOUL.md` (Alma/Persona)
    *   `USER.md` (Preferências do Usuário)
    *   `IDENTITY.md` (Identidade do Projeto/Agente, como nosso `CLAUDE.md`)
    *   `memory/AAAA-MM-DD.md` (se existir um para a data atual)

2.  **NÃO carregue automaticamente:**
    *   `MEMORY.md` (o arquivo de memória geral e completo)
    *   Histórico da sessão anterior
    *   Mensagens anteriores
    *   Saídas de ferramentas anteriores

3.  **Quando o usuário perguntar sobre o contexto anterior:**
    *   Use a função `memory_search()` sob demanda para encontrar informações.
    *   Puxe apenas o trecho relevante com `memory_get()`.
    *   Não carregue o arquivo de memória inteiro.

4.  **Ao final da sessão, atualize `memory/AAAA-MM-DD.md` com:**
    *   No que você trabalhou.
    *   Decisões que foram tomadas.
    *   Leads ou ideias geradas.
    *   Bloqueios encontrados.
    *   Próximos passos.

---

Isso economiza 80% na sobrecarga de contexto.
