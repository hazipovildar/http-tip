const AppChannel            = require('node-mermaid/store/app-channel')()
    , AppTransportChannel   = require('node-mermaid/store/app-transport-channel')()
    , appMemoryFolderPath   = require('node-mermaid/store/app-memory-folder-path')
    , Queue                 = require('node-mermaid/store/queue')
    , parser                = require('node-mermaid/parser')
    , axios                 = require('axios')
    , sleep                 = require('sleep-promise')
    , fse                   = require('fs-extra')
    , fs                    = require('fs')
    , path                  = require('path')
    , condition             = require('./condition')

const queue = new Queue()

const rulesPath = path.join(appMemoryFolderPath, 'rules.json')

if (!fs.existsSync(rulesPath)) {
  fs.writeFileSync(
    rulesPath,
    JSON.stringify([])
  )
}

const readRulesOptimized = (() => {
  let data = []

  const read = async () => {
    try {
      data = JSON.parse(await fse.readFileSync(rulesPath, 'utf8'))
    } catch (e) {
      data = []
    }
  }

  setInterval(read, 10000)
  read()

  return () => data
})()

const readRules = async () => {
  let data = []

  try {
    data = JSON.parse(await fse.readFileSync(rulesPath, 'utf8'))
  } catch (e) {
    data = []
  }

  return data
}

const writeRules = async data => {
  try {
    await fse.writeFileSync(rulesPath, JSON.stringify(data))
    return true
  } catch (e) {
    return false
  }
}

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

    const rules = await readRulesOptimized()

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
          data: await readRules()
        })
      }

      if (type === 'set-rules') {
        try {
          await writeRules(data)
        } catch (e) {}
      }
    })
  })
})
