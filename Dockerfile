# Site do CADEE para o Dokku da Rede IC (docs: README, seção "Hospedar o site na Rede IC").
# Etapa 1: compila o app. Etapa 2: serve só os arquivos estáticos com nginx sem root.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# endereço da {sigaa} api embutido no build (não é segredo). Vazio = sem login, só a API estática.
ARG VITE_SIGAA_API_URL=https://cadee-api.app.ic.ufba.br
ENV VITE_SIGAA_API_URL=${VITE_SIGAA_API_URL}
RUN npm run build \
 && ORIGEM="$(printf '%s' "$VITE_SIGAA_API_URL" | sed -nE 's#^(https?://[^/]+).*#\1#p')" \
 && mkdir -p /out \
 && sed "s#__SIGAA_API_ORIGIN__#${ORIGEM}#g" deploy/nginx/security-headers.conf > /out/security-headers.conf \
 && cp deploy/nginx/default.conf /out/default.conf

FROM nginxinc/nginx-unprivileged:1.28-alpine
COPY --from=build /out/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /out/security-headers.conf /etc/nginx/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
# porta do nginx sem root; o Dokku mapeia https:443 → 8080
EXPOSE 8080
