-- CreateTable
CREATE TABLE "Chargeback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT,
    "chargeId" TEXT,
    "gateway" TEXT NOT NULL DEFAULT 'pagarme',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reason" TEXT,
    "tipoContestacao" TEXT,
    "valorTransacao" TEXT,
    "bandeira" TEXT,
    "finalCartao" TEXT,
    "dataTransacao" TEXT,
    "numeroPedido" TEXT,
    "nomeCliente" TEXT,
    "cpfCliente" TEXT,
    "emailCliente" TEXT,
    "enderecoEntrega" TEXT,
    "itensPedido" TEXT,
    "eventosRastreio" TEXT,
    "comunicacoes" TEXT,
    "shopifyData" TEXT,
    "rawPayload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Defesa" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chargebackId" TEXT NOT NULL,
    "dossie" TEXT NOT NULL,
    "contestacao" TEXT NOT NULL,
    "parecerJuridico" TEXT,
    "status" TEXT NOT NULL DEFAULT 'drafted',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "pagarmeResponse" TEXT,
    "submittedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Defesa_chargebackId_fkey" FOREIGN KEY ("chargebackId") REFERENCES "Chargeback" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "externalId" TEXT,
    "payload" TEXT NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "defesaId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebhookEvent_defesaId_fkey" FOREIGN KEY ("defesaId") REFERENCES "Defesa" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Chargeback_externalId_key" ON "Chargeback"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_source_externalId_key" ON "WebhookEvent"("source", "externalId");
