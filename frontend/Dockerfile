FROM node:18-alpine

WORKDIR /app

COPY package.json ./
# Force clean install and explicit tailwind version
RUN rm -rf node_modules package-lock.json && \
    npm install && \
    npm install tailwindcss@3.3.3 postcss@8.4.31 autoprefixer@10.4.16 --save-dev

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
