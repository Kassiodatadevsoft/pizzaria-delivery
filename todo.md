# Pizzaria Delivery - TODO

## Banco de Dados & Backend
- [x] Schema: tabela `pizza_categories` (categorias do cardápio)
- [x] Schema: tabela `pizzas` (itens do cardápio com foto, preço, tamanhos)
- [x] Schema: tabela `orders` (pedidos com status, cliente, endereço, pagamento)
- [x] Schema: tabela `order_items` (itens de cada pedido)
- [x] Rotas tRPC: CRUD de categorias (admin)
- [x] Rotas tRPC: CRUD de pizzas/cardápio (admin)
- [x] Rotas tRPC: criar pedido (público)
- [x] Rotas tRPC: listar pedidos (admin)
- [x] Rotas tRPC: atualizar status do pedido (admin)
- [x] Rotas tRPC: buscar pedido por ID/token (público - acompanhamento)
- [x] Notificação automática ao dono ao criar novo pedido
- [x] Seed de dados iniciais (categorias e pizzas de exemplo)

## Frontend - Área do Cliente
- [x] Página inicial com banner hero, destaques e CTA
- [x] Página de cardápio com filtro por categoria
- [x] Componente de card de pizza com foto, descrição, preço e tamanhos
- [x] Carrinho de compras (drawer lateral) com add/remove/quantidade
- [x] Página de checkout com formulário (nome, endereço, telefone, pagamento)
- [x] Página de login/cadastro de clientes
- [x] Página de acompanhamento de pedido em tempo real (por token)
- [x] Página de histórico de pedidos (cliente logado)

## Frontend - Painel Administrativo
- [x] Layout do painel admin com sidebar
- [x] Página de listagem e gerenciamento de pedidos
- [x] Atualização de status do pedido (recebido → em preparo → saiu → entregue)
- [x] Página de gerenciamento do cardápio (listar, adicionar, editar, remover)

## Estilo & UX
- [x] Tema elegante e sofisticado (paleta escura com dourado/âmbar)
- [x] Tipografia premium (fontes Google: Playfair Display + Inter)
- [x] Animações suaves e micro-interações
- [x] Design responsivo (mobile-first)
- [x] Estados de loading, erro e vazio em todas as páginas

## Testes
- [x] Testes vitest para rotas de pedidos (12 testes passando)
- [x] Testes vitest para rotas de cardápio

## Cardápio Real - Pizzaria Prime
- [x] Limpar dados de exemplo e popular com cardápio real da Pizzaria Prime
- [x] Adaptar schema para suportar produtos sem tamanho (preço único) e com tamanhos (pizzas)
- [x] Categorias: Pizzas Doces, Petiscos, Porções 3.0, Pratos Executivos, Hambúrgueres, Barcas, Refrigerantes, Águas, Sucos, Aperitivos, Cervejas/Chopp
- [x] Renomear pizzaria para "Pizzaria Prime" em todo o sistema
- [x] Adaptar tamanhos das pizzas: Brotinho, Pequena, Média, Grande, Trem, Bi-Trem
- [x] Corrigir campo size em order_items para aceitar qualquer string (VARCHAR 32)

## Meio a Meio e Bordas Recheadas
- [x] Schema: adicionar campo `crust` (borda) e `crustPrice` em order_items
- [x] Schema: adicionar campo `secondFlavorId` e `secondFlavorName` em order_items para meio a meio
- [x] Backend: atualizar router de criação de pedido para aceitar borda e segundo sabor
- [x] Frontend: modal de seleção de pizza com opção de meio a meio (escolher 2 sabores)
- [x] Frontend: seleção de borda recheada com sabores e preço adicional por tamanho
- [x] Frontend: exibir corretamente meio a meio e borda no carrinho e checkout
- [x] Frontend: exibir meio a meio e borda no acompanhamento de pedido e painel admin

## Ajustes Solicitados
- [x] Remover CEP, cidade e estado do formulário de checkout
- [x] Criar página/botão de compartilhamento do link via WhatsApp para o dono

## Cardápio Completo (Atualização)
- [x] Inserir 40 pizzas tradicionais (Atum, Bacon, Calabresa, Frango, Portuguesa, Prime, etc.)
- [x] Inserir 4 pizzas doces faltantes (Banana com Canela, Banana Nevada, Brigadeiro, etc.)
- [x] Inserir 4 Cremes Especiais (Maracujá, Cupuaçu, Morango, Caja)
- [x] Desativar Cervejas & Chopp do delivery (conforme solicitado)
- [x] Total: 121 produtos em 12 categorias ativas

## Integração ERP + Multi-tenant + WhatsApp
- [x] Schema: adicionar campo `erpCode` (código do produto no ERP) na tabela pizzas
- [x] Schema: criar tabela `api_keys` para autenticação do ERP
- [x] Endpoint REST GET /api/erp/orders/new — pedidos novos com todos os dados e erpCode
- [x] Endpoint REST POST /api/erp/orders/:id/status — atualizar status do pedido pelo ERP
- [x] Endpoint REST POST /api/erp/products — criar/atualizar produto vindo do ERP (com erpCode)
- [x] Endpoint REST GET /api/erp/products — listar produtos com erpCode para o ERP
- [x] Painel admin: campo erpCode visível e editável no gerenciamento do cardápio
- [x] Painel admin: página de gerenciamento de API Keys
- [ ] Documentação dos endpoints REST para o desenvolvedor Delphi
- [ ] Integração WhatsApp via Evolution API/Z-API (envio automático de link)
- [ ] Painel admin: configuração do WhatsApp (número, instância, API Key)
- [ ] Multi-tenant: estrutura para múltiplas pizzarias no mesmo servidor
