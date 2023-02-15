const AppChannel            = require('node-mermaid/store/app-channel')()
    , AppTransportChannel   = require('node-mermaid/store/app-transport-channel')()
    , Queue                 = require('node-mermaid/store/queue')
    , MemoryFileJSON        = require('node-mermaid/store/memory-file-json')
    , parser                = require('node-mermaid/parser')
    , axios                 = require('axios')
    , sleep                 = require('sleep-promise')
    , fse                   = require('fs-extra')
    , fs                    = require('fs')
    , path                  = require('path')
    , condition             = require('./condition')

const queue = new Queue()

const mfJSON = new MemoryFileJSON('rules', [], 10000)

queue.executer(async (data, next, repeat) => {
  const { commands, username, message, tokenCount } = data
  let isError = false

  for (let i = 0; i < commands.length; i++) {
    const command = commands[i]

    if (command.delay) {
      await sleep(parseInt(command.delay))
    }

    if (command.url) {
      try {
        const url = command.url
                      .replace(/=\$\{username\}/gi, '='+username)
                      .replace(/=\$\{message\}/gi, '='+message)
                      .replace(/=\$\{tokenCount\}/gi, '='+tokenCount)

        await axios.get(url)
      } catch (e) {
        isError = true
      }
    }
  }

  if (!isError) {
    next()
  } else {
    repeat()
  }
})

const httpTipRequest = async data => {
  if (data.isEasyData && data.easyData.events.isTokens) {
    const tokenCount = data.easyData.tokenCount
        , message = data.easyData.message
        , username = data.easyData.username

    const rules = mfJSON.readInterval()

    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i]

      const isPlatform = (rule.platform === data.extension.platform || rule.platform === 'All platforms')

      const isTrue = rule.conditions
                      .map(
                        ({ operator, number }) =>
                          condition(tokenCount, operator, parseInt(number))
                      )
                      .find(isTrue => !isTrue) !== false

      if (isTrue && isPlatform) {
        queue.add({
          commands: rule.commands,
          tokenCount,
          message,
          username
        })
      }
    }
  }
}

queue.status(count => {
  AppTransportChannel.writeData({
    type: 'queue',
    data: count
  })
})

AppChannel.on('connect', () => {
  AppTransportChannel.on('connect', () => {
    AppChannel.on('data', data => {
      parser.Chaturbate(data, httpTipRequest)
      parser.xHamsterLive(data, httpTipRequest)
      parser.Stripchat(data, httpTipRequest)
      parser.BongaCams(data, httpTipRequest)
    })

    AppChannel.on('reload', () => {
      AppTransportChannel.writeData({
        type: 'reload'
      })
    })

    AppTransportChannel.on('readData', async ({ type, data }) => {
      if (type === 'get-rules') {
        AppTransportChannel.writeData({
          type: 'get-rules',
          data: await mfJSON.read()
        })
      }

      if (type === 'set-rules') {
        try {
          await mfJSON.write(data)
        } catch (e) {}
      }
    })
  })
})
