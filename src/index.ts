import type { Plugin } from 'vite'
import { createFilter, dataToEsm, FilterPattern } from '@rollup/pluginutils'

export interface Options {
    include?: FilterPattern
    exclude?: FilterPattern
    compress?: boolean | ((code: string) => string | Promise<string>)
}

export default function (userOptions: Options = {}): Plugin {
    const options: Options = Object.assign(
        {
            include: [
                '**/*.vs',
                '**/*.fs',
                '**/*.vert',
                '**/*.frag',
                '**/*.glsl',
                '**/*.wgsl',
            ],
            compress: true,
        } as Options,
        userOptions
    )

    const filter = createFilter(options.include, options.exclude)

    const compress = options.compress === true ? defaultCompress : options.compress
    let transform_opt=options.transform || ((code) => code)
    
    switch(options.transform){
        case 'base64':
            transform_opt=(source,id)=>{
                return `data:application/wasm;base64,${Buffer.from(source).toString('base64')}`
            }   
            break;
        default:
            break;
    }
    return {
        name: 'vite-plugin-string',
        async transform(source, id) {
            if (!filter(id)) return
            
            const transformedSource = await transform_opt(source, id)

            return dataToEsm(compress ? await compress(transformedSource) : transformedSource)
        },
    }
}

export function defaultCompress(code: string) {
    let needNewline = false
    return code
        .replace(
            /\\(?:\r\n|\n\r|\n|\r)|\/\*.*?\*\/|\/\/(?:\\(?:\r\n|\n\r|\n|\r)|[^\n\r])*/g,
            ''
        )
        .split(/\n+/)
        .reduce((result, line) => {
            line = line.trim().replace(/\s{2,}|\t/, ' ')
            if (line.charAt(0) === '#') {
                if (needNewline) {
                    result.push('\n')
                }
                result.push(line, '\n')
                needNewline = false
            } else {
                result.push(
                    line.replace(
                        /\s*({|}|=|\*|,|\+|\/|>|<|&|\||\[|\]|\(|\)|-|!|;)\s*/g,
                        '$1'
                    )
                )
                needNewline = true
            }
            return result
        }, [] as string[])
        .join('')
        .replace(/\n+/g, '\n')
}
