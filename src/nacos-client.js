import { NacosConfigClient } from 'nacos';
import { writeFile, readFile } from 'fs/promises';
import { resolve } from 'path';
import { existsSync } from 'fs';

export async function fetchNacosAndWrite(config) {
  // 校验必填参数
  if (!config.dataId || !config.group || !config.serverAddr) {
    console.error('❌ [next-nacos] 缺少 Nacos 配置参数：dataId/group/serverAddr 必须填写');
    process.exit(1);
  }

  const configClient = new NacosConfigClient({
    ...config,
    requestTimeout: 10000, // 适当延长超时，网络抖动更稳定
  });

  try {
    console.log('🔄 [next-nacos] 正在从 Nacos 拉取配置...');
    const data = await configClient.getConfig(config.dataId, config.group);
    
    if (!data) {
      console.warn('⚠️ [next-nacos] Nacos 配置内容为空，跳过写入');
      process.exit(0);
    }

    const envPath = resolve(process.cwd(), '.env');
    let existingContent = '';

    // 读取现有 .env
    if (existsSync(envPath)) {
      existingContent = await readFile(envPath, 'utf-8');
    }

    // 按行拆分，清理旧的 NEXT_PUBLIC_NACOS 配置
    const lines = existingContent.split(/\r?\n/); // 兼容 Windows \r\n 换行
    const filteredLines = [];
    let inNacosBlock = false;

    for (const line of lines) {
      const trimmedLine = line.trim();

      // 匹配旧配置开头
      if (trimmedLine.startsWith('NEXT_PUBLIC_NACOS=')) {
        inNacosBlock = true;
        continue;
      }

      // 匹配多行结束符 '
      if (inNacosBlock && trimmedLine === `'`) {
        inNacosBlock = false;
        continue;
      }

      // 非 Nacos 配置行保留
      if (!inNacosBlock) {
        filteredLines.push(line);
      }
    }

    // 清理末尾空行，避免文件越来越大
    while (filteredLines.length > 0 && filteredLines.at(-1).trim() === '') {
      filteredLines.pop();
    }

    // 追加新配置
    if (filteredLines.length > 0) {
      filteredLines.push(''); // 空行分隔
    }
    // 转义单引号，防止配置内容包含 ' 导致语法断裂
    const escapedData = data.replace(/'/g, "\\'");
    filteredLines.push(`NEXT_PUBLIC_NACOS='${escapedData}'`);

    // 写入文件（统一 \n 换行，兼容跨平台）
    const newContent = filteredLines.join('\n') + '\n';
    await writeFile(envPath, newContent, 'utf-8');

    console.log('✅ [next-nacos] .env 配置更新成功');
    process.exit(0);

  } catch (err) {
    console.error('❌ [next-nacos] 拉取 Nacos 配置失败：', err.message);
    // 开发/生产可选择：失败不退出，使用旧配置
    // process.exit(1);
    process.exit(1);
  }
}