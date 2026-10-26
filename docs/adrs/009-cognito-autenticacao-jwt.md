# ADR 009: Autenticação com Amazon Cognito e Tokens JWT

## Status
Aceito

## Contexto
O sistema atende múltiplos perfis de usuários (`cidadao`, `operador`, `gestor`, `admin`). A API precisa validar requisições autenticadas com controle baseado em papéis (RBAC), suporte a MFA e recuperação de senhas, sem armazenar senhas brutas no banco PostgreSQL.

## Decisão
Adotamos o **Amazon Cognito User Pools** para gerenciamento de identidades, autenticação e emissão de tokens JWT (Access Token e ID Token). A API Fastify valida a assinatura criptográfica dos tokens (JWKS) e extrai o claim `cognito_sub` e grupos (`cognito:groups`).

## Justificativa
1. **Conformidade de Segurança**: Políticas nativas de complexidade de senha, MFA e detecção de credenciais comprometidas.
2. **Desacoplamento de Credenciais**: A tabela `usuarios` do banco PostgreSQL armazena apenas metadados de domínio vinculados ao `cognito_sub`, eliminando o risco de exposição de senhas ou hashes em dumps de banco.

