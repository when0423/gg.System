// --- AUTO INSTALADOR DE SEGURANÇA PARA A HOSPEDAGEM ---
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

if (!fs.existsSync(path.join(__dirname, 'node_modules'))) {
    console.log('📦 Pasta node_modules não encontrada! Iniciando instalação dos pacotes, aguarde...');
    try {
        execSync('npm install', { stdio: 'inherit' });
        console.log('✅ Todos os pacotes foram instalados com sucesso!');
    } catch (error) {
        console.error('❌ Erro crítico ao tentar instalar os pacotes automaticamente:', error);
        process.exit(1);
    }
}
// -----------------------------------------------------

const { 
    Client, 
    Collection, 
    GatewayIntentBits, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder, 
    EmbedBuilder, 
    ButtonBuilder, 
    ButtonStyle 
} = require('discord.js');
require('dotenv').config();
const { DisTube } = require('distube');

// Inicializa o cliente do bot com suporte a servidores e estados de voz (necessário para música)
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates
    ] 
});

client.commands = new Collection();

// --- 1. CONFIGURAÇÃO ESTÁVEL DO SISTEMA DE MÚSICA (DISTUBE) ---
client.distube = new DisTube(client, {
    emitNewSongOnly: true
});

// Avisa no chat quando uma música começa a tocar
client.distube.on('playSong', (queue, song) => {
    queue.textChannel.send(`🎶 Tocando agora: **${song.name}** - \`${song.formattedDuration}\`\nSolicitado por: ${song.user}`);
});

// --- 2. CARREGAMENTO DINÂMICO DOS COMANDOS (COMMAND HANDLER) ---
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        }
    }
}

// Evento disparado quando o bot se conecta com sucesso
client.once('ready', () => {
    console.log(`⚓ Pronto, capitão! Luna está online como ${client.user.tag}`);
});

// --- 3. O OUVINTE GERAL DE INTERAÇÕES (COMANDOS, BOTÕES E MODALS) ---
client.on('interactionCreate', async interaction => {
    
    // CASO A: Execução de Comandos de Barra (/)
    if (interaction.isChatInputCommand()) {
        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'Ocorreu um erro ao executar esse comando!', ephemeral: true });
            } else {
                await interaction.reply({ content: 'Ocorreu um erro ao executar esse comando!', ephemeral: true });
            }
        }
        return;
    }

    // CASO B: Cliques em Botões (Tickets, Campeonatos e Painel Staff)
    if (interaction.isButton()) {
        
        // 🎫 AÇÃO: Criar Tópico do Ticket
        if (interaction.customId === 'abrir_ticket_botao') {
            await interaction.deferReply({ ephemeral: true });

            try {
                const thread = await interaction.channel.threads.create({
                    name: `ticket-${interaction.user.username}`,
                    autoArchiveDuration: 60,
                    type: 11, // Tópico Público
                    reason: `Ticket aberto por ${interaction.user.tag}`,
                });

                await thread.members.add(interaction.user.id);

                await thread.send({
                    content: `👋 Bem-vindo ao seu suporte, ${interaction.user}! Um de nossos colaboradores já vai te atender.\nDescreva seu problema enquanto aguarda.`,
                });

                // Painel administrativo dentro do tópico criado
                const embedStaff = new EmbedBuilder()
                    .setColor('#FFD700')
                    .setTitle('🛠️ Painel de Controle do Ticket')
                    .setDescription('Gerenciamento exclusivo para colaboradores e staff.')
                    .addFields(
                        { name: 'Status:', value: '🔴 Aguardando Atendimento' },
                        { name: 'Responsável:', value: 'Nenhum' }
                    );

                // Armazenamento dinâmico do ID do criador nos botões
                const btnAssumir = new ButtonBuilder().setCustomId(`tk_assumir_${interaction.user.id}`).setLabel('Assumir').setEmoji('🙋‍♂️').setStyle(ButtonStyle.Primary);
                const btnNotificar = new ButtonBuilder().setCustomId(`tk_notificar_${interaction.user.id}`).setLabel('Notificar Membro').setEmoji('🔔').setStyle(ButtonStyle.Secondary);
                const btnTransferir = new ButtonBuilder().setCustomId(`tk_transferir_${interaction.user.id}`).setLabel('Passar Staff').setEmoji('🔄').setStyle(ButtonStyle.Secondary);
                const btnFinalizar = new ButtonBuilder().setCustomId('tk_finalizar').setLabel('Finalizar (Excluir)').setEmoji('🔒').setStyle(ButtonStyle.Danger);

                const rowStaff = new ActionRowBuilder().addComponents(btnAssumir, btnNotificar, btnTransferir, btnFinalizar);

                await thread.send({ embeds: [embedStaff], components: [rowStaff] });
                await interaction.editReply({ content: `Seu ticket foi gerado com sucesso! Clique aqui para entrar: ${thread}` });
            } catch (error) {
                console.error(error);
                await interaction.editReply({ content: '❌ Não consegui abrir o tópico do ticket. Verifique minhas permissões.' });
            }
            return;
        }

        // 🙋‍♂️ STAFF: Assumir o Ticket
        if (interaction.customId.startsWith('tk_assumir_')) {
            const embedModificado = EmbedBuilder.from(interaction.message.embeds[0])
                .setColor('#00FF00')
                .setFields(
                    { name: 'Status:', value: '🟢 Em Atendimento' },
                    { name: 'Responsável:', value: `${interaction.user}` }
                );

            await interaction.update({ embeds: [embedModificado] });
            await interaction.channel.send({ content: `📢 ${interaction.user} assumiu la liderança deste suporte!` });
            return;
        }

        // 🔔 STAFF: Notificar Membro Inativo
        if (interaction.customId.startsWith('tk_notificar_')) {
            const criadorId = interaction.customId.split('_')[2];
            await interaction.reply({ content: `Notificação enviada com sucesso.`, ephemeral: true });
            await interaction.channel.send({ content: `⚠️ <@${criadorId}>, a nossa Staff está aguardando sua resposta aqui no tópico para continuar o atendimento!` });
            return;
        }

        // 🔄 STAFF: Passar Atendimento para Outro Colaborador
        if (interaction.customId.startsWith('tk_transferir_')) {
            const embedModificado = EmbedBuilder.from(interaction.message.embeds[0])
                .setColor('#FFA500')
                .setFields(
                    { name: 'Status:', value: '🔄 Aguardando Nova Direção' },
                    { name: 'Responsável Antigo:', value: `${interaction.user}` }
                );

            await interaction.update({ embeds: [embedModificado] });
            await interaction.channel.send({ content: `🔄 Este ticket foi liberado por ${interaction.user} e está aberto para que outro colaborador assuma!` });
            return;
        }

        // 🔒 STAFF: Finalizar Ticket (Deleta o Tópico)
        if (interaction.customId === 'tk_finalizar') {
            await interaction.reply({ content: '🔒 Finalizando atendimento... Este tópico será totalmente excluído em 5 seconds!' });
            
            setTimeout(async () => {
                try {
                    await interaction.channel.delete();
                } catch (error) {
                    console.error('Erro ao deletar o tópico:', error);
                }
            }, 5000);
            return;
        }

        // 🏆 CAMPEONATO: Abrir o Formulário ao Clicar em Se Inscrever
        if (interaction.customId === 'inscrever_campeonato_botao') {
            const modal = new ModalBuilder()
                .setCustomId('modal_campeonato')
                .setTitle('Ficha de Inscrição');

            const nickInput = new TextInputBuilder()
                .setCustomId('campeonato_nick')
                .setLabel("Qual o seu Nick no jogo?")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const idInput = new TextInputBuilder()
                .setCustomId('campeonato_id')
                .setLabel("Confirme seu ID ou WhatsApp:")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const expInput = new TextInputBuilder()
                .setCustomId('campeonato_exp')
                .setLabel("Já participou de torneios antes?")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false);

            modal.addComponents(
                new ActionRowBuilder().addComponents(nickInput),
                new ActionRowBuilder().addComponents(idInput),
                new ActionRowBuilder().addComponents(expInput)
            );

            await interaction.showModal(modal);
            return;
        }

        // 🛠️ STAFF: Approvar Inscrição do Campeonato
        if (interaction.customId === 'aprovar_inscricao') {
            const embedOriginal = interaction.message.embeds[0];
            const embedAprovado = EmbedBuilder.from(embedOriginal)
                .setColor('#00FF00')
                .setTitle('✅ Inscrição Aprovada');

            await interaction.update({ embeds: [embedAprovado], components: [] });
            return;
        }

        // 🛠️ STAFF: Recusar Inscrição do Campeonato
        if (interaction.customId === 'recusar_inscricao') {
            const embedOriginal = interaction.message.embeds[0];
            const embedRecusado = EmbedBuilder.from(embedOriginal)
                .setColor('#FF0000')
                .setTitle('❌ Inscrição Recusada');

            await interaction.update({ embeds: [embedRecusado], components: [] });
            return;
        }
    }

    // CASO C: Recebimento de Formulários (Modal Submit)
    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'modal_campeonato') {
            const nick = interaction.fields.getTextInputValue('campeonato_nick');
            const discordId = interaction.fields.getTextInputValue('campeonato_id');
            const experiencia = interaction.fields.getTextInputValue('campeonato_exp') || 'Nenhuma informada.';

            const embedFicha = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('📥 Nova Ficha de Campeonato Recebida')
                .addFields(
                    { name: 'Membro:', value: `${interaction.user} (${interaction.user.tag})` },
                    { name: 'Nick Informado:', value: nick },
                    { name: 'Contato/ID:', value: discordId },
                    { name: 'Experiência em Torneios:', value: experiencia }
                )
                .setTimestamp();

            const bAprovar = new ButtonBuilder().setCustomId('aprovar_inscricao').setLabel('Aprovar').setStyle(ButtonStyle.Success);
            const bRecusar = new ButtonBuilder().setCustomId('recusar_inscricao').setLabel('Recusar').setStyle(ButtonStyle.Danger);
            const rowBotoes = new ActionRowBuilder().addComponents(bAprovar, bRecusar);

            await interaction.channel.send({ 
                content: '🔔 **Atenção Colaboradores:** Nova ficha de inscrição pendente de avaliação!', 
                embeds: [embedFicha], 
                components: [rowBotoes] 
            });

            await interaction.reply({ 
                content: 'Sua inscrição foi coletada e enviada diretamente para a aprovação dos nossos colaboradores, capitão!', 
                ephemeral: true 
            });
        }
    }
});

client.login(process.env.BOT_TOKEN);
