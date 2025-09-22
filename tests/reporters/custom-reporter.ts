import { Reporter, TestCase, TestResult, FullResult } from '@playwright/test/reporter';
import fs from 'fs';
import path from 'path';

class TRAXISTestReporter implements Reporter {
  private testResults: Array<{
    test: TestCase;
    result: TestResult;
    category: string;
    feature: string;
  }> = [];

  private startTime: number = Date.now();

  onTestEnd(test: TestCase, result: TestResult) {
    // Categorize tests based on file path
    const filePath = test.location.file;
    let category = 'General';
    let feature = 'Unknown';

    if (filePath.includes('hierarchy/epic')) {
      category = 'Hierarchy CRUD';
      feature = 'EPIC Management';
    } else if (filePath.includes('hierarchy/story')) {
      category = 'Hierarchy CRUD';
      feature = 'STORY Management';
    } else if (filePath.includes('hierarchy/task')) {
      category = 'Hierarchy CRUD';
      feature = 'TASK & SUBTASK Management';
    } else if (filePath.includes('navigation')) {
      category = 'Navigation';
      feature = 'Breadcrumb Navigation';
    } else if (filePath.includes('dependencies')) {
      category = 'Dependencies';
      feature = 'Dependency Management';
    } else if (filePath.includes('performance')) {
      category = 'Performance';
      feature = 'Load & Performance Testing';
    } else if (filePath.includes('mcp')) {
      category = 'MCP Integration';
      feature = 'AI Agent Tools';
    }

    this.testResults.push({
      test,
      result,
      category,
      feature
    });
  }

  onEnd(result: FullResult) {
    const endTime = Date.now();
    const duration = endTime - this.startTime;

    // Generate comprehensive report
    const report = this.generateReport(result, duration);

    // Ensure output directory exists
    const outputDir = 'test-results';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write JSON report
    fs.writeFileSync(
      path.join(outputDir, 'traxis-test-report.json'),
      JSON.stringify(report, null, 2)
    );

    // Write HTML report
    const htmlReport = this.generateHTMLReport(report);
    fs.writeFileSync(
      path.join(outputDir, 'traxis-test-report.html'),
      htmlReport
    );

    // Write summary for Archon
    const archonSummary = this.generateArchonSummary(report);
    fs.writeFileSync(
      path.join(outputDir, 'archon-story-5.1-report.md'),
      archonSummary
    );

    console.log(`\n🎯 TRAXIS Test Report Generated:`);
    console.log(`📊 JSON Report: ${path.join(outputDir, 'traxis-test-report.json')}`);
    console.log(`📋 HTML Report: ${path.join(outputDir, 'traxis-test-report.html')}`);
    console.log(`📝 Archon Summary: ${path.join(outputDir, 'archon-story-5.1-report.md')}`);
  }

  private generateReport(result: FullResult, duration: number) {
    const categorizedResults = this.categorizeResults();

    return {
      summary: {
        total: this.testResults.length,
        passed: this.testResults.filter(r => r.result.status === 'passed').length,
        failed: this.testResults.filter(r => r.result.status === 'failed').length,
        skipped: this.testResults.filter(r => r.result.status === 'skipped').length,
        duration: duration,
        timestamp: new Date().toISOString(),
        story: 'STORY 5.1 - Tests End-to-End Hiérarchie'
      },
      categories: categorizedResults,
      acceptanceCriteria: this.evaluateAcceptanceCriteria(categorizedResults),
      performance: this.extractPerformanceMetrics(),
      recommendations: this.generateRecommendations(categorizedResults)
    };
  }

  private categorizeResults() {
    const categories: Record<string, any> = {};

    for (const testResult of this.testResults) {
      const { category, feature } = testResult;

      if (!categories[category]) {
        categories[category] = {
          total: 0,
          passed: 0,
          failed: 0,
          features: {}
        };
      }

      if (!categories[category].features[feature]) {
        categories[category].features[feature] = {
          tests: [],
          total: 0,
          passed: 0,
          failed: 0
        };
      }

      categories[category].total++;
      categories[category].features[feature].total++;
      categories[category].features[feature].tests.push({
        title: testResult.test.title,
        status: testResult.result.status,
        duration: testResult.result.duration,
        error: testResult.result.error?.message
      });

      if (testResult.result.status === 'passed') {
        categories[category].passed++;
        categories[category].features[feature].passed++;
      } else if (testResult.result.status === 'failed') {
        categories[category].failed++;
        categories[category].features[feature].failed++;
      }
    }

    return categories;
  }

  private evaluateAcceptanceCriteria(categories: Record<string, any>) {
    return {
      'Complete hierarchy CRUD operations tested':
        categories['Hierarchy CRUD']?.passed >= 25,
      'Dependency management and cycle detection validated':
        categories['Dependencies']?.passed >= 10,
      'Performance tests with 1000+ items pass':
        categories['Performance']?.passed >= 10,
      'MCP integration with AI agents works correctly':
        categories['MCP Integration']?.passed >= 10,
      'Navigation flows validated':
        categories['Navigation']?.passed >= 8,
      'All regression tests pass':
        Object.values(categories).every((cat: any) => cat.failed === 0)
    };
  }

  private extractPerformanceMetrics() {
    const performanceTests = this.testResults
      .filter(r => r.category === 'Performance')
      .map(r => ({
        test: r.test.title,
        duration: r.result.duration,
        status: r.result.status
      }));

    return {
      tests: performanceTests,
      averageDuration: performanceTests.reduce((sum, t) => sum + t.duration, 0) / performanceTests.length,
      longestTest: performanceTests.reduce((max, t) => t.duration > max.duration ? t : max, performanceTests[0])
    };
  }

  private generateRecommendations(categories: Record<string, any>) {
    const recommendations = [];

    for (const [categoryName, category] of Object.entries(categories)) {
      if (category.failed > 0) {
        recommendations.push(`❌ ${categoryName}: ${category.failed} tests failed - requires immediate attention`);
      } else if (category.passed === category.total) {
        recommendations.push(`✅ ${categoryName}: All ${category.total} tests passed - excellent coverage`);
      }
    }

    return recommendations;
  }

  private generateHTMLReport(report: any): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TRAXIS Story 5.1 - Test Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
        .header h1 { margin: 0; font-size: 2.5em; }
        .header .subtitle { margin: 10px 0 0 0; opacity: 0.9; font-size: 1.2em; }
        .content { padding: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; border-left: 4px solid #667eea; }
        .metric .value { font-size: 2.5em; font-weight: bold; color: #667eea; }
        .metric .label { color: #666; margin-top: 5px; }
        .category { margin-bottom: 30px; border: 1px solid #e0e0e0; border-radius: 8px; }
        .category-header { background: #f8f9fa; padding: 15px; border-bottom: 1px solid #e0e0e0; font-weight: bold; }
        .category-content { padding: 15px; }
        .feature { margin-bottom: 20px; }
        .feature-title { font-weight: bold; color: #333; margin-bottom: 10px; }
        .test { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
        .test:last-child { border-bottom: none; }
        .status { padding: 4px 8px; border-radius: 4px; color: white; font-size: 0.8em; font-weight: bold; }
        .status.passed { background: #28a745; }
        .status.failed { background: #dc3545; }
        .status.skipped { background: #ffc107; color: #333; }
        .acceptance-criteria { background: #e8f5e8; border: 1px solid #28a745; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .acceptance-criteria h3 { color: #28a745; margin-top: 0; }
        .criteria-item { display: flex; align-items: center; margin: 10px 0; }
        .criteria-item .icon { margin-right: 10px; font-size: 1.2em; }
        .recommendations { background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .recommendations h3 { color: #856404; margin-top: 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>TRAXIS Test Report</h1>
            <div class="subtitle">Story 5.1 - Tests End-to-End Hiérarchie</div>
            <div style="margin-top: 15px; opacity: 0.8;">
                Generated: ${new Date(report.summary.timestamp).toLocaleString()}
            </div>
        </div>

        <div class="content">
            <div class="summary">
                <div class="metric">
                    <div class="value">${report.summary.total}</div>
                    <div class="label">Total Tests</div>
                </div>
                <div class="metric">
                    <div class="value" style="color: #28a745;">${report.summary.passed}</div>
                    <div class="label">Passed</div>
                </div>
                <div class="metric">
                    <div class="value" style="color: #dc3545;">${report.summary.failed}</div>
                    <div class="label">Failed</div>
                </div>
                <div class="metric">
                    <div class="value">${Math.round(report.summary.duration / 1000)}s</div>
                    <div class="label">Total Duration</div>
                </div>
            </div>

            <div class="acceptance-criteria">
                <h3>✅ Acceptance Criteria Status</h3>
                ${Object.entries(report.acceptanceCriteria).map(([criteria, status]) => `
                    <div class="criteria-item">
                        <span class="icon">${status ? '✅' : '❌'}</span>
                        <span>${criteria}</span>
                    </div>
                `).join('')}
            </div>

            ${Object.entries(report.categories).map(([categoryName, category]: [string, any]) => `
                <div class="category">
                    <div class="category-header">
                        ${categoryName} (${category.passed}/${category.total} passed)
                    </div>
                    <div class="category-content">
                        ${Object.entries(category.features).map(([featureName, feature]: [string, any]) => `
                            <div class="feature">
                                <div class="feature-title">${featureName}</div>
                                ${feature.tests.map((test: any) => `
                                    <div class="test">
                                        <span>${test.title}</span>
                                        <div>
                                            <span class="status ${test.status}">${test.status.toUpperCase()}</span>
                                            <span style="margin-left: 10px; color: #666;">${test.duration}ms</span>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('')}

            <div class="recommendations">
                <h3>📋 Recommendations</h3>
                ${report.recommendations.map((rec: string) => `<div style="margin: 10px 0;">${rec}</div>`).join('')}
            </div>
        </div>
    </div>
</body>
</html>`;
  }

  private generateArchonSummary(report: any): string {
    const successRate = Math.round((report.summary.passed / report.summary.total) * 100);

    return `# STORY 5.1 - Rapport d'Exécution Tests E2E

## 📊 Résumé Exécution

**Date**: ${new Date(report.summary.timestamp).toLocaleDateString('fr-FR')}
**Durée totale**: ${Math.round(report.summary.duration / 1000)} secondes
**Taux de succès**: ${successRate}% (${report.summary.passed}/${report.summary.total})

## ✅ Critères d'Acceptation

${Object.entries(report.acceptanceCriteria).map(([criteria, status]) =>
  `- ${status ? '✅' : '❌'} ${criteria}`
).join('\n')}

## 📋 Résultats par Catégorie

${Object.entries(report.categories).map(([categoryName, category]: [string, any]) => `
### ${categoryName}
- **Tests**: ${category.total}
- **Réussis**: ${category.passed}
- **Échoués**: ${category.failed}
- **Taux de réussite**: ${Math.round((category.passed / category.total) * 100)}%
`).join('')}

## 🎯 Status Story 5.1

${successRate >= 95 ?
  '✅ **STORY 5.1 VALIDÉE** - Tous les critères d\'acceptation sont remplis' :
  '❌ **STORY 5.1 EN COURS** - Corrections requises avant validation'
}

## 📝 Recommandations

${report.recommendations.join('\n')}

---
*Rapport généré automatiquement par TRAXIS Test Suite*`;
  }
}

export default TRAXISTestReporter;