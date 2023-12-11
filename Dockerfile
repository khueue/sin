# UPGRADE_POINT.
# See: https://hub.docker.com/_/python/
# NOTE: See ScanCode's Python requirements:
# - https://scancode-toolkit.readthedocs.io/en/latest/getting-started/install.html#install-prerequisites
FROM --platform=linux/amd64 python:3.10.13-bookworm

RUN apt update

# UPGRADE_POINT.
# See: https://github.com/nodesource/distributions/blob/master/README.md#installation-instructions
ARG NODE_MAJOR=21
RUN apt install -y ca-certificates curl gnupg
RUN mkdir -p /etc/apt/keyrings
RUN curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
RUN echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list
RUN apt update
RUN apt install -y nodejs

# Useful for browsing files and the database.
RUN apt install -y less
RUN apt install -y sqlite3

WORKDIR /scancode

# UPGRADE_POINT.
# See: https://github.com/nexB/scancode-toolkit/releases/
# NOTE: Match with Python version.
ARG SCANCODE_URL=https://github.com/nexB/scancode-toolkit/releases/download/v32.0.8/scancode-toolkit-v32.0.8_py3.10-linux.tar.gz
RUN \
	wget ${SCANCODE_URL} \
	&& tar -xvf ./scancode-toolkit-*.tar.gz --strip-components=1 \
	&& rm ./scancode-toolkit-*.tar.gz

# Initialize tool.
RUN ./scancode --help

# NOTE: This (and only this) seems to work on ARM:
# See: https://github.com/nexB/scancode-toolkit/releases
# RUN pip install scancode-toolkit==32.0.2

WORKDIR /app

# Run app from anywhere.
ENV PATH=/app:${PATH}

# Ignore irrelevant ScanCode warnings.
ENV PYTHONWARNINGS="ignore"

# Give Node more space.
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Pretty terminal with basic tab-completion.
# See: https://gist.github.com/scmx/242caa249b0ea343e2588adea14479e6
RUN apt install -y bash-completion
RUN echo '[[ $PS1 && -f /usr/share/bash-completion/bash_completion ]] && . /usr/share/bash-completion/bash_completion' >> ~/.bashrc
RUN echo 'export PS1="\n🐳 \[\033[1;36m\]sin.ts \[\033[1;34m\]\$PWD\[\033[0;35m\]\n\[\033[1;36m\]$ \[\033[0m\]"' >> ~/.bashrc

# Install Node modules when package.json changes.
COPY ./app/package*.json ./
RUN npm install

# UPGRADE_POINT.
# See: https://github.com/privatenumber/tsx/releases
RUN npm install --global tsx@4.6.2

# Copy all app code.
COPY ./app/lib/ ./lib/
COPY ./app/*.* ./

ENTRYPOINT [ "bash" ]
