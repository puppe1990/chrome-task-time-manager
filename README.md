# ⏱️ Task Time Manager - Extensão Chrome

Uma extensão do Chrome para gerenciamento de tarefas com cronômetro integrado, prazos e acompanhamento de progresso.

## 🚀 Funcionalidades

- ✅ **Gerenciamento de Tarefas**: Criar, editar e excluir tarefas
- ⏱️ **Cronômetro Integrado**: Cronometrar tempo real gasto em cada tarefa
- 📊 **Dashboard de Estatísticas**: Acompanhar progresso e eficiência
- 🏷️ **Categorização**: Organizar tarefas por categorias
- 📅 **Prazos**: Definir e acompanhar deadlines
- 🔍 **Filtros**: Filtrar tarefas por status e categoria
- 💾 **Armazenamento Local**: Dados salvos localmente no Chrome

## 📦 Instalação

### Método 1: Carregar Extensão Desenvolvimento

1. **Baixe ou clone este repositório**
   ```bash
   git clone <url-do-repositorio>
   cd chrome-task-time-manager
   ```

2. **Abra o Chrome e vá para Extensões**
   - Digite `chrome://extensions/` na barra de endereços
   - Ou vá em Menu → Mais ferramentas → Extensões

3. **Ative o Modo Desenvolvedor**
   - Ative o toggle "Modo do desenvolvedor" no canto superior direito

4. **Carregue a Extensão**
   - Clique em "Carregar sem compactação"
   - Selecione a pasta `chrome-task-time-manager`
   - A extensão aparecerá na lista

5. **Fixar a Extensão (Opcional)**
   - Clique no ícone de quebra-cabeça na barra de ferramentas
   - Clique no pin ao lado de "Task Time Manager"

## 🎯 Como Usar

### Criando uma Tarefa
1. Clique no ícone da extensão na barra de ferramentas
2. Clique em "Nova Tarefa"
3. Preencha os campos:
   - **Título**: Nome da tarefa (obrigatório)
   - **Descrição**: Detalhes adicionais
   - **Categoria**: Tipo da tarefa (ex: Trabalho, Pessoal, Estudo)
   - **Horas Estimadas**: Tempo previsto para conclusão
   - **Prazo**: Data limite (opcional)
   - **Status**: Estado atual da tarefa

### Usando o Cronômetro
1. Na lista de tarefas, encontre a tarefa desejada
2. Clique no botão ▶️ para iniciar o cronômetro
3. O tempo será contado em tempo real
4. Clique em ⏸️ para pausar
5. Clique em 🔄 para resetar o tempo

### Visualizando Estatísticas
1. Clique na aba "Estatísticas"
2. Veja métricas como:
   - Total de tarefas
   - Tarefas concluídas
   - Taxa de conclusão
   - Horas estimadas vs reais
   - Eficiência geral

### Filtrando Tarefas
- Use os filtros na aba "Tarefas" para:
  - Filtrar por status (Não Iniciado, Em Progresso, etc.)
  - Filtrar por categoria

## 🛠️ Estrutura do Projeto

```
chrome-task-time-manager/
├── manifest.json          # Configuração da extensão
├── background.js          # Service worker
├── popup.html            # Interface principal
├── popup.js              # Lógica da aplicação
├── styles.css            # Estilos da interface
├── icons/                # Ícones da extensão
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── create_icons.py       # Script para gerar ícones
└── README.md            # Este arquivo
```

## 🔧 Tecnologias Utilizadas

- **Manifest V3**: Versão mais recente do Chrome Extensions API
- **HTML5/CSS3**: Interface responsiva e moderna
- **JavaScript ES6+**: Lógica da aplicação
- **Chrome Storage API**: Armazenamento local de dados
- **CSS Grid/Flexbox**: Layout responsivo

## 📱 Interface

A extensão possui uma interface moderna e intuitiva com:

- **Design Responsivo**: Adapta-se ao tamanho do popup
- **Gradientes Modernos**: Visual atrativo
- **Ícones Intuitivos**: Fácil identificação de ações
- **Cores Semânticas**: Status visuais claros
- **Animações Suaves**: Transições fluidas

## 🔒 Privacidade

- ✅ **Dados Locais**: Todas as informações ficam armazenadas localmente no seu navegador
- ✅ **Sem Coleta**: Nenhum dado é enviado para servidores externos
- ✅ **Sem Rastreamento**: Não há coleta de informações pessoais
- ✅ **Controle Total**: Você tem controle completo sobre seus dados

## 🐛 Solução de Problemas

### A extensão não aparece
- Verifique se o modo desenvolvedor está ativado
- Recarregue a extensão clicando no ícone de atualização
- Verifique se não há erros no console (F12)

### Dados não são salvos
- Verifique se a extensão tem permissão de armazenamento
- Limpe o cache do navegador se necessário

### Interface não carrega
- Verifique se todos os arquivos estão na pasta correta
- Abra o console do navegador para verificar erros

## 🤝 Contribuição

Contribuições são bem-vindas! Para contribuir:

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## 🎉 Agradecimentos

- Chrome Extensions API
- Comunidade de desenvolvedores de extensões
- Usuários que testaram e forneceram feedback

---

**Desenvolvido com ❤️ para produtividade e organização de tarefas**
