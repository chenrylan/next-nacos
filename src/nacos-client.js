import { NacosConfigClient } from 'nacos';
import { writeFile, readFile } from 'fs/promises';
import { resolve } from 'path';
import { existsSync } from 'fs';

export async function fetchNacosAndWrite(config) {
  const configClient = new NacosConfigClient({
    ...config,
    requestTimeout: 6000,
  });

  try {
    const data = await configClient.getConfig(config.dataId, config.group);
    const envPath = resolve(process.cwd(), '.env');
    
    // 增量更新模式：读取现有内容，移除旧的 NEXT_PUBLIC_NACOS 行，追加新值
    let existingContent = '';
    
    // 如果 .env 文件存在，读取现有内容
    if (existsSync(envPath)) {
      existingContent = await readFile(envPath, 'utf-8');
    }
    
    // 将内容按行分割，过滤掉旧的 NEXT_PUBLIC_NACOS 行
    const lines = existingContent.split('\n');
    const filteredLines = lines.filter(line => {
      // 移除以 NEXT_PUBLIC_NACOS= 开头的行（包括带引号和不带引号的情况）
      const trimmedLine = line.trim();
      return !trimmedLine.startsWith('NEXT_PUBLIC_NACOS=');
    });
    
    // 移除末尾的空行，然后添加新的 NEXT_PUBLIC_NACOS 值
    while (filteredLines.length > 0 && filteredLines[filteredLines.length - 1].trim() === '') {
      filteredLines.pop();
    }
    
    // 如果文件不为空，添加换行符
    if (filteredLines.length > 0) {
      filteredLines.push('');
    }
    
    // 添加新的 NEXT_PUBLIC_NACOS 行
    filteredLines.push(`NEXT_PUBLIC_NACOS='${data}'`);
    
    // 写入更新后的内容
    const newContent = filteredLines.join('\n') + '\n';
    await writeFile(envPath, newContent, 'utf-8');
    
    console.log('✅ [next-nacos] .env file has been written');
    process.exit(0);
  } catch (err) {
    console.error('❌ [next-nacos] Failed to get config from Nacos:', err.message);

    process.exit(1);
  }
}