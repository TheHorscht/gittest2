import subprocess

process = subprocess.run(['git', 'tag', '--points-at', 'HEAD'],
  stdout=subprocess.PIPE)

# First change on bran

output = process.stdout.decode('utf-8').strip()
print(output == '')
