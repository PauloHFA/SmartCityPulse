# ADR 008: GitHub Actions com AWS OIDC vs AWS CodePipeline

## Status
Aceito

## Contexto
O pipeline de Integração Contínua e Entrega Contínua (CI/CD) precisa construir imagens Docker, executar testes de qualidade, enviar ao Amazon ECR e atualizar o serviço ECS Fargate, sem expor chaves estáticas de longa duração (`AWS_ACCESS_KEY_ID` e `AWS_SECRET_ACCESS_KEY`).

## Decisão
Adotamos **GitHub Actions** federado com a AWS via **OpenID Connect (OIDC)**, com role IAM (`github-deploy`) com política de confiança estritamente limitada ao repositório `PauloHFA/SmartCityPulse` e branch `main`.

## Justificativa
1. **Segurança Máxima**: Elimina o risco de vazamento de credenciais na nuvem ou no código; tokens de curta duração são gerados dinamicamente por job.
2. **Custo Zero de Ferramenta**: Utiliza os minutos gratuitos de runners do GitHub Actions em vez de instâncias fixas ou custos por pipeline ativo no AWS CodePipeline.
3. **Visibilidade do Desenvolvedor**: Todo o feedback de lint, build e testes fica centralizado na interface de Pull Requests do GitHub.

